import json
import base64
import logging
from typing import AsyncGenerator, List
from sqlalchemy.orm import Session
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage

from app.models.models import Chat, Message, DocumentChunk
from app.services.llm import get_llm
from app.services.vector_store import VectorStoreManager

logger = logging.getLogger(__name__)

# Prompt templates
REFORMULATE_PROMPT = """Given a chat history and the latest user question which might reference context in the chat history, formulate a standalone question which can be understood without the chat history. Do NOT answer the question, just reformulate it if needed and otherwise return it as is.

Chat History:
{chat_history}

User Question: {user_question}
Standalone Question:"""

QA_PROMPT = """You are given a user question, and please write clean, concise and accurate answer to the question.
You will be given a set of related contexts to the question, which are numbered sequentially starting from 1.
Each context has an implicit reference number based on its position in the array (first context is 1, second is 2, etc.).
Please use these contexts and cite them using the format [citation:x] at the end of each sentence where applicable.
Your answer must be correct, accurate and written by an expert using an unbiased and professional tone.
Please limit to 1024 tokens. Do not give any information that is not related to the question, and do not repeat.
Say 'information is missing on' followed by the related topic, if the given context do not provide sufficient information.
If a sentence draws from multiple contexts, please list all applicable citations, like [citation:1][citation:2].
Other than code and specific names and citations, your answer must be written in the same language as the question.
Be concise.

Context:
{context}

Remember: Cite contexts by their position number (1 for first context, 2 for second, etc.) and don't blindly repeat the contexts verbatim."""

async def generate_response(
    db: Session,
    chat_id: int,
    user_query: str
) -> AsyncGenerator[str, None]:
    """
    RAG Dialogue pipeline:
    1. Save user query in SQL.
    2. Retrieve chat history.
    3. Reformulate query to standalone query.
    4. Query Chroma DB.
    5. Stream base64 contexts followed by LLM response.
    6. Save final response in SQL.
    """
    try:
        # 1. Fetch Chat and knowledge base details
        chat = db.query(Chat).filter(Chat.id == chat_id).first()
        if not chat:
            yield f'3:"Error: Chat session not found"\n'
            return

        kb_id = chat.knowledge_base_id
        
        # 2. Save user message to SQLite
        user_msg = Message(chat_id=chat_id, role="user", content=user_query)
        db.add(user_msg)
        db.commit()

        # 3. Retrieve conversation history
        history_msgs = db.query(Message).filter(Message.chat_id == chat_id).order_by(Message.created_at.asc()).all()
        
        # Build string representation of history
        history_str = ""
        chat_history_list = []
        # Exclude the latest user message which we just added
        for m in history_msgs[:-1]:
            history_str += f"{m.role.capitalize()}: {m.content}\n"
            if m.role == "user":
                chat_history_list.append(HumanMessage(content=m.content))
            else:
                # Strip out base64 part from older assistant responses if any
                assistant_content = m.content
                if "__LLM_RESPONSE__" in assistant_content:
                    assistant_content = assistant_content.split("__LLM_RESPONSE__")[-1]
                chat_history_list.append(AIMessage(content=assistant_content))

        # 4. Reformulate user query using LLM if history exists
        standalone_query = user_query
        llm = get_llm(temperature=0.0, streaming=False)
        
        if len(chat_history_list) > 0:
            try:
                reformulate_prompt_formatted = REFORMULATE_PROMPT.format(
                    chat_history=history_str,
                    user_question=user_query
                )
                response = await llm.ainvoke([HumanMessage(content=reformulate_prompt_formatted)])
                standalone_query = response.content.strip()
                logger.info(f"Original query: '{user_query}' -> Standalone query: '{standalone_query}'")
            except Exception as e:
                logger.error(f"Error reformulating query: {str(e)}. Using original query.")

        # 5. Retrieve documents from ChromaDB
        vector_store = VectorStoreManager(f"kb_{kb_id}")
        docs_with_scores = vector_store.similarity_search_with_score(standalone_query, k=4)
        
        # Format contexts list
        context_str = ""
        serializable_context = []
        
        for idx, (doc, score) in enumerate(docs_with_scores):
            # Index starts at 1
            context_num = idx + 1
            context_str += f"\n\n[{context_num}] {doc.page_content}\n\n"
            
            serializable_context.append({
                "page_content": doc.page_content,
                "metadata": doc.metadata,
                "score": float(score)
            })

        # Send retrieved contexts as Base64 JSON first
        separator = "__LLM_RESPONSE__"
        if serializable_context:
            context_data = json.dumps({"context": serializable_context})
            base64_context = base64.b64encode(context_data.encode("utf-8")).decode("utf-8")
            yield f'0:"{base64_context}{separator}"\n'
            full_response = f"{base64_context}{separator}"
        else:
            full_response = ""

        # 6. Stream final answer from LLM
        stream_llm = get_llm(temperature=0.2, streaming=True)
        
        # Build prompt inputs
        qa_system_message = SystemMessage(content=QA_PROMPT.format(context=context_str if context_str else "No relevant context found."))
        messages = [qa_system_message]
        messages.extend(chat_history_list)
        messages.append(HumanMessage(content=standalone_query))
        
        # Create bot message entry in SQLite first (we will update its content at the end)
        bot_msg = Message(chat_id=chat_id, role="assistant", content="")
        db.add(bot_msg)
        db.commit()

        async for chunk in stream_llm.astream(messages):
            content_chunk = chunk.content
            if content_chunk:
                full_response += content_chunk
                # Escape quotes and newlines for text/event stream
                escaped_chunk = content_chunk.replace('"', '\\"').replace('\n', '\\n')
                yield f'0:"{escaped_chunk}"\n'
                
        # 7. Update SQLite bot message content
        bot_msg.content = full_response
        db.commit()
        
    except Exception as e:
        logger.error(f"Error generating RAG response: {str(e)}")
        yield f'3:"Error: {str(e)}"\n'
