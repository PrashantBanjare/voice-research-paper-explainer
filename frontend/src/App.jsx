import { useState } from "react";
import {
  Mic,
  Send,
  Plus,
  FileText,
  Volume2,
  Bot,
  User,
  Upload,
} from "lucide-react";
import API from "./api";

function App() {
  const [file, setFile] = useState(null);
  const [pdfStatus, setPdfStatus] = useState("");
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isThinking, setIsThinking] = useState(false);

  const handleUpload = async (selectedFile) => {
    if (!selectedFile) return;

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      setPdfStatus("Processing PDF...");
      const res = await API.post("/upload-pdf", formData);
      setFile(selectedFile);
      setPdfStatus(res.data.message);
    } catch {
      setPdfStatus("PDF upload failed");
    }
  };

  const handleAsk = async () => {
    if (!question.trim()) return alert("Enter a question");

    const currentQuestion = question;

    setMessages((prev) => [...prev, { role: "user", text: currentQuestion }]);
    setQuestion("");
    setIsThinking(true);

    try {
      const res = await API.post("/ask", null, {
        params: { question: currentQuestion },
      });

      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: res.data.answer || res.data.error || "No answer received",
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "ai", text: "Error getting answer" },
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleSpeakAnswer = async (text) => {
    try {
      const res = await API.post("/speak", null, {
        params: { text },
        responseType: "blob",
      });

      const audio = new Audio(URL.createObjectURL(res.data));
      audio.play();
    } catch {
      alert("Audio failed");
    }
  };

  const handleVoice = async () => {
    try {
      setIsRecording(true);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      let chunks = [];

      recorder.ondataavailable = (e) => chunks.push(e.data);

      recorder.onstop = async () => {
        setIsRecording(false);

        const blob = new Blob(chunks, { type: "audio/webm" });
        const formData = new FormData();
        formData.append("audio", blob, "voice.webm");

        try {
          setIsThinking(true);
          const res = await API.post("/voice-question", formData);

          setMessages((prev) => [
            ...prev,
            {
              role: "user",
              text: res.data.transcribed_question || "Voice question",
            },
            {
              role: "ai",
              text: res.data.answer || res.data.error || "No answer received",
            },
          ]);
        } catch {
          setMessages((prev) => [
            ...prev,
            { role: "ai", text: "Voice failed" },
          ]);
        } finally {
          setIsThinking(false);
        }
      };

      recorder.start();

      setTimeout(() => {
        recorder.stop();
        stream.getTracks().forEach((track) => track.stop());
      }, 4000);
    } catch {
      setIsRecording(false);
      alert("Microphone permission denied");
    }
  };

  return (
    <div className="min-h-screen text-white flex relative overflow-hidden bg-black">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden -z-10">
        <div className="absolute top-20 left-20 h-72 w-72 bg-cyan-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-20 h-80 w-80 bg-purple-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute top-1/2 left-1/2 h-96 w-96 bg-pink-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-black to-indigo-950 opacity-90"></div>
      </div>

      {/* Sidebar */}
      <aside className="hidden md:flex w-72 bg-white/5 backdrop-blur-xl border-r border-white/10 flex-col p-4">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/30">
            <Bot size={22} />
          </div>
          <div>
            <h2 className="font-semibold">Paper AI</h2>
            <p className="text-xs text-cyan-200/70">Advanced Research Assistant</p>
          </div>
        </div>

        <label className="cursor-pointer flex items-center gap-2 bg-white/10 hover:bg-cyan-500/20 border border-white/10 rounded-xl px-4 py-3 transition">
          <Plus size={18} />
          <span>Upload PDF</span>
          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => handleUpload(e.target.files[0])}
          />
        </label>

        <div className="mt-5 bg-white/10 rounded-xl p-4 border border-white/10 backdrop-blur-xl">
          <div className="flex items-center gap-2 text-sm text-cyan-100 mb-2">
            <FileText size={16} />
            Current Paper
          </div>

          <p className="text-xs text-slate-300 break-words">
            {file ? file.name : "No PDF uploaded"}
          </p>

          {pdfStatus && (
            <p className="text-xs text-emerald-300 mt-3">{pdfStatus}</p>
          )}
        </div>

        <div className="mt-auto text-xs text-slate-400">
          RAG + LLM + Voice AI
        </div>
      </aside>

      {/* Main Area */}
      <main className="flex-1 flex flex-col h-screen">
        <header className="h-16 border-b border-white/10 flex items-center justify-between px-5 bg-white/5 backdrop-blur-xl">
          <div>
            <h1 className="font-semibold text-lg">
              Voice Research Paper Explainer
            </h1>
            <p className="text-xs text-cyan-200/70">
              Ask questions by typing or voice
            </p>
          </div>

          <label className="md:hidden cursor-pointer bg-white/10 hover:bg-cyan-500/20 rounded-xl px-3 py-2">
            <Upload size={18} />
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => handleUpload(e.target.files[0])}
            />
          </label>
        </header>

        <section className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-3xl mx-auto space-y-5">
            {messages.length === 0 && (
              <div className="text-center mt-24">
                <div className="mx-auto h-16 w-16 rounded-2xl bg-gradient-to-r from-cyan-400 to-purple-500 flex items-center justify-center mb-5 shadow-lg shadow-cyan-500/30">
                  <FileText size={34} />
                </div>

                <h2 className="text-3xl font-bold mb-3 bg-gradient-to-r from-cyan-300 via-blue-300 to-purple-300 bg-clip-text text-transparent">
                  How can I help with your paper?
                </h2>

                <p className="text-slate-300">
                  Upload a PDF, then ask for summary, methodology, equations, or viva questions.
                </p>

                {pdfStatus && (
                  <p className="mt-4 text-sm text-emerald-300">{pdfStatus}</p>
                )}
              </div>
            )}

            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex gap-3 ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {msg.role === "ai" && (
                  <div className="h-9 w-9 rounded-full bg-gradient-to-r from-cyan-400 to-purple-500 flex items-center justify-center shrink-0 shadow-md shadow-cyan-500/30">
                    <Bot size={18} />
                  </div>
                )}

                <div
                  className={`max-w-[80%] rounded-2xl px-5 py-4 text-sm leading-7 whitespace-pre-line ${
                    msg.role === "user"
                      ? "bg-gradient-to-r from-cyan-500 to-blue-600 shadow-lg shadow-blue-500/20"
                      : "bg-white/10 backdrop-blur-lg border border-white/10 shadow-lg shadow-purple-500/10"
                  }`}
                >
                  {msg.text}

                  {msg.role === "ai" && (
                    <button
                      onClick={() => handleSpeakAnswer(msg.text)}
                      className="mt-3 flex items-center gap-2 text-xs text-cyan-200 hover:text-white transition"
                    >
                      <Volume2 size={15} />
                      Speak answer
                    </button>
                  )}
                </div>

                {msg.role === "user" && (
                  <div className="h-9 w-9 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 flex items-center justify-center shrink-0">
                    <User size={18} />
                  </div>
                )}
              </div>
            ))}

            {isThinking && (
              <div className="flex gap-3 justify-start">
                <div className="h-9 w-9 rounded-full bg-gradient-to-r from-cyan-400 to-purple-500 flex items-center justify-center">
                  <Bot size={18} />
                </div>
                <div className="bg-white/10 backdrop-blur-lg border border-white/10 rounded-2xl px-5 py-4 text-sm text-slate-300">
                  Thinking...
                </div>
              </div>
            )}

            {isRecording && (
              <div className="flex justify-center">
                <div className="flex items-center gap-3 bg-red-500/20 border border-red-400/30 text-red-200 px-5 py-3 rounded-2xl backdrop-blur-xl">
                  <span className="h-3 w-3 bg-red-500 rounded-full animate-ping"></span>
                  Microphone is on. Speak now...
                </div>
              </div>
            )}
          </div>
        </section>

        <footer className="px-4 pb-5">
          <div className="max-w-3xl mx-auto bg-white/10 backdrop-blur-xl border border-white/10 rounded-3xl p-3 shadow-2xl shadow-cyan-500/10">
            <div className="flex items-end gap-2">
              <label className="cursor-pointer h-11 w-11 rounded-full hover:bg-cyan-500/20 flex items-center justify-center transition">
                <Plus size={22} />
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => handleUpload(e.target.files[0])}
                />
              </label>

              <textarea
                rows="1"
                placeholder="Ask anything about your research paper..."
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleAsk();
                  }
                }}
                className="flex-1 resize-none bg-transparent outline-none text-sm py-3 max-h-32 placeholder:text-slate-400"
              />

              <button
                onClick={handleVoice}
                className={`relative h-11 w-11 rounded-full flex items-center justify-center transition ${
                  isRecording
                    ? "bg-red-600"
                    : "hover:bg-purple-500/30"
                }`}
              >
                {isRecording && (
                  <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-50"></span>
                )}
                <Mic size={21} className="relative z-10" />
              </button>

              <button
                onClick={handleAsk}
                className="h-11 w-11 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 text-white hover:scale-105 flex items-center justify-center transition shadow-lg shadow-cyan-500/30"
              >
                <Send size={20} />
              </button>
            </div>
          </div>

          <p className="text-center text-xs text-slate-400 mt-2">
            AI may make mistakes. Verify answers from the original paper.
          </p>
        </footer>
      </main>
    </div>
  );
}

export default App;