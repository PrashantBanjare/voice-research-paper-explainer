from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import os
import shutil
from dotenv import load_dotenv
from groq import Groq
from pypdf import PdfReader

from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_groq import ChatGroq
from langchain_core.prompts import PromptTemplate
from fastapi.responses import FileResponse
from gtts import gTTS

load_dotenv()

app = FastAPI()
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

pdf_text = ""
vector_store = None


def extract_text_from_pdf(file_path):
    reader = PdfReader(file_path)
    text = ""

    for page in reader.pages:
        page_text = page.extract_text()
        if page_text:
            text += page_text + "\n"

    return text


def create_chunks(text):
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=100
    )
    return splitter.split_text(text)


def create_vector_store(chunks):
    embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
    return FAISS.from_texts(chunks, embeddings)


llm = ChatGroq(
    groq_api_key=os.getenv("GROQ_API_KEY"),
    model_name="llama-3.1-8b-instant"
)


prompt_template = """
You are a helpful research paper assistant.

Answer the question based ONLY on the context below.
If the answer is not available in the context, say: "Not found in the paper."

Context:
{context}

Question:
{question}

Answer:
"""

prompt = PromptTemplate(
    template=prompt_template,
    input_variables=["context", "question"]
)


@app.get("/")
def read_root():
    return {"message": "Backend is running 🚀"}


@app.post("/upload-pdf")
async def upload_pdf(file: UploadFile = File(...)):
    global pdf_text, vector_store

    file_path = os.path.join(UPLOAD_DIR, file.filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    pdf_text = extract_text_from_pdf(file_path)

    if not pdf_text.strip():
        return {"error": "No text extracted from PDF"}

    chunks = create_chunks(pdf_text)
    vector_store = create_vector_store(chunks)

    return {
        "message": "PDF processed successfully",
        "filename": file.filename,
        "characters_extracted": len(pdf_text),
        "chunks_created": len(chunks)
    }


@app.get("/pdf-text-preview")
def pdf_text_preview():
    return {"preview": pdf_text[:1000]}


@app.post("/ask")
async def ask_question(question: str):
    global vector_store

    if vector_store is None:
        return {"error": "Upload PDF first"}

    try:
        docs = vector_store.similarity_search(question, k=3)
        context = "\n".join([doc.page_content for doc in docs])

        final_prompt = prompt.format(
            context=context,
            question=question
        )

        response = llm.invoke(final_prompt)

        return {
            "question": question,
            "answer": response.content
        }

    except Exception as e:
        return {"error": str(e)}

@app.post("/speak")
async def speak_answer(text: str):
    try:
        audio_file = "response.mp3"
        tts = gTTS(text=text, lang="en")
        tts.save(audio_file)

        return FileResponse(
            audio_file,
            media_type="audio/mpeg",
            filename="response.mp3"
        )

    except Exception as e:
        return {"error": str(e)}


@app.post("/voice-question")
async def voice_question(audio: UploadFile = File(...)):
    global vector_store

    if vector_store is None:
        return {"error": "Upload PDF first"}

    try:
        audio_path = os.path.join(UPLOAD_DIR, audio.filename)

        with open(audio_path, "wb") as buffer:
            shutil.copyfileobj(audio.file, buffer)

        with open(audio_path, "rb") as audio_file:
            transcription = groq_client.audio.transcriptions.create(
                file=audio_file,
                model="whisper-large-v3"
            )

        question = transcription.text

        docs = vector_store.similarity_search(question, k=3)
        context = "\n".join([doc.page_content for doc in docs])

        final_prompt = prompt.format(
            context=context,
            question=question
        )

        response = llm.invoke(final_prompt)

        return {
            "transcribed_question": question,
            "answer": response.content
        }

    except Exception as e:
        return {"error": str(e)}