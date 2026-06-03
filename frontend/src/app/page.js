"use client";

import React, { useState, useRef, useEffect } from "react";
import { 
  Cpu, 
  UploadCloud, 
  FileText, 
  Activity, 
  Video, 
  Eye, 
  Smile, 
  Award, 
  ArrowRight, 
  AlertTriangle, 
  CheckCircle2, 
  Clock,
  Sparkles,
  RefreshCw,
  Terminal,
  ShieldCheck,
  History,
  TrendingUp,
  Trash2,
  Search,
  UserCheck,
  Sun,
  Moon
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from "recharts";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const WS_URL = BACKEND_URL.replace(/^http/, "ws");

export default function Home() {
  // Theme state
  const [theme, setTheme] = useState("dark");

  // App Phase: 'setup' | 'interview' | 'report'
  const [phase, setPhase] = useState("setup");
  const [role, setRole] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Database integrations
  const [candidateId, setCandidateId] = useState(null);
  const [customCandidateId, setCustomCandidateId] = useState(""); // optional ID at start
  const [pastSessions, setPastSessions] = useState([]);
  
  // Archive vs Candidate Lookup tabs
  const [lookupTab, setLookupTab] = useState("archive"); // 'archive' | 'lookup'
  const [searchId, setSearchId] = useState("");
  const [searchedCandidate, setSearchedCandidate] = useState(null);
  const [searchError, setSearchError] = useState(null);
  
  // Interview state
  const [questions, setQuestions] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answer, setAnswer] = useState("");
  const [history, setHistory] = useState([]);
  
  // Real-time telemetry logs
  const [liveMetrics, setLiveMetrics] = useState({
    posture: "Calibrating",
    posture_score: 100,
    eye_contact: true,
    eye_contact_score: 100,
    expression: "Calibrating",
    expression_score: 100,
    feedback: []
  });
  
  // Timeline log for chart visualization in report
  const [telemetryTimeline, setTelemetryTimeline] = useState([]);
  
  // Final Evaluation Report state
  const [report, setReport] = useState(null);
  
  // Refs for media streaming and analysis
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const wsRef = useRef(null);
  const streamRef = useRef(null);
  const animationFrameId = useRef(null);
  
  // Current question-specific telemetry buckets
  const currentEyeContactScores = useRef([]);
  const currentPostureScores = useRef([]);
  const currentExpressions = useRef([]);
  
  // Load session archives on mount or phase returns
  useEffect(() => {
    if (phase === "setup") {
      fetchPastSessions();
    }
  }, [phase]);

  // Load and apply persistent theme mode
  useEffect(() => {
    const savedTheme = localStorage.getItem("aura-theme") || "dark";
    setTheme(savedTheme);
    document.documentElement.setAttribute("data-theme", savedTheme);
  }, []);

  // Clean up streams on unmount
  useEffect(() => {
    return () => {
      stopCameraAndWebSocket();
    };
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("aura-theme", nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
  };

  const fetchPastSessions = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/history`);
      if (res.ok) {
        const data = await res.json();
        setPastSessions(data);
      }
    } catch (err) {
      console.error("Failed to load past evaluations:", err);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const stopCameraAndWebSocket = () => {
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  };

  // Phase 1: Setup - Upload Resume & Submit
  const handleStartSetup = async (e) => {
    e.preventDefault();
    if (!file) {
      setError("Please upload your PDF resume first.");
      return;
    }
    if (!role.trim()) {
      setError("Please specify the target job role.");
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("role", role);
    if (customCandidateId.trim()) {
      formData.append("candidate_id", customCandidateId.trim());
    }

    try {
      const res = await fetch(`${BACKEND_URL}/upload-resume`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Failed to parse resume.");
      }

      const data = await res.json();
      setQuestions(data.questions);
      setCandidateId(data.candidate_id); // Save Candidate ID from DB
      setPhase("interview");
      
      // Start camera & WebSocket connection for live diagnostics
      setTimeout(initiateCameraAndWebSocket, 500);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  // Fetch past report directly from DB database
  const handleAccessPastReport = async (id) => {
    setLoading(true);
    setPhase("report");
    setError(null);
    
    try {
      const res = await fetch(`${BACKEND_URL}/report/${id}`);
      if (!res.ok) {
        throw new Error("Failed to load historical evaluation report.");
      }
      
      const data = await res.json();
      
      // Re-compile telemetry timeline chart data from history transcript
      const timeline = [];
      data.history_transcript.forEach((item, index) => {
        const pScore = item.posture_scores.length ? Math.round(item.posture_scores.reduce((a, b) => a + b, 0) / item.posture_scores.length) : 90;
        const eScore = item.eye_contact_scores.length ? Math.round(item.eye_contact_scores.reduce((a, b) => a + b, 0) / item.eye_contact_scores.length) : 95;
        
        timeline.push({
          time: `Q${index + 1}`,
          posture: pScore,
          eyeContact: eScore
        });
      });
      setTelemetryTimeline(timeline);
      setReport(data);
      setRole(data.role);
    } catch (err) {
      setError(err.message || "Failed to retrieve archive record.");
    } finally {
      setLoading(false);
    }
  };

  // Search a candidate by their ID
  const handleSearchCandidate = async (e) => {
    e.preventDefault();
    if (!searchId.trim()) return;

    setSearchError(null);
    setSearchedCandidate(null);
    setLoading(true);

    try {
      const res = await fetch(`${BACKEND_URL}/candidate/${searchId.trim()}`);
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error("Candidate ID not found.");
        }
        throw new Error("Failed to query Candidate profile.");
      }
      const data = await res.json();
      setSearchedCandidate(data);
    } catch (err) {
      setSearchError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  // Delete a specific evaluation session
  const handleDeleteReport = async (e, id) => {
    e.stopPropagation(); // Avoid triggering card details loading
    if (!window.confirm("Are you sure you want to permanently delete this evaluation record from the database?")) {
      return;
    }

    try {
      const res = await fetch(`${BACKEND_URL}/report/${id}`, {
        method: "DELETE"
      });
      
      if (!res.ok) {
        throw new Error("Failed to delete record.");
      }
      
      // Refresh local session lists
      fetchPastSessions();
      if (searchedCandidate && searchedCandidate.candidate_id === parseInt(searchId)) {
        // Refresh lookup list
        const cRes = await fetch(`${BACKEND_URL}/candidate/${searchId.trim()}`);
        if (cRes.ok) {
          const cData = await cRes.json();
          setSearchedCandidate(cData);
        } else {
          setSearchedCandidate(null);
        }
      }
    } catch (err) {
      alert(err.message || "Failed to delete record.");
    }
  };

  // Initialize webcam and backend WebSockets connection
  const initiateCameraAndWebSocket = async () => {
    try {
      // Connect WebSocket
      const ws = new WebSocket(`${WS_URL}/ws/interview`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("Telemetry WebSocket connected.");
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === "metrics") {
          const metrics = msg.metrics;
          setLiveMetrics(metrics);
          
          // Log coordinates for active question analysis
          currentEyeContactScores.current.push(metrics.eye_contact_score);
          currentPostureScores.current.push(metrics.posture_score);
          currentExpressions.current.push(metrics.expression);
        }
      };

      ws.onerror = (err) => {
        console.error("WebSocket error:", err);
      };

      // Request webcam access
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, frameRate: 15 }
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Start frame capture loop
      startFrameStreaming();
    } catch (err) {
      setError("Webcam access denied. Please grant camera permission to continue.");
    }
  };

  // Capture canvas frame and send via WebSocket
  const startFrameStreaming = () => {
    const captureFrame = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ws = wsRef.current;

      if (video && canvas && ws && ws.readyState === WebSocket.OPEN) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          // Compress quality to 0.4 to prevent WebSocket overflow
          const base64Data = canvas.toDataURL("image/jpeg", 0.4);
          
          ws.send(JSON.stringify({
            type: "frame",
            data: base64Data
          }));
        }
      }
      // Stream at ~8 frames per second
      setTimeout(() => {
        animationFrameId.current = requestAnimationFrame(captureFrame);
      }, 125);
    };

    animationFrameId.current = requestAnimationFrame(captureFrame);
  };

  // Submit Answer & load next question
  const handleSubmitAnswer = () => {
    if (!answer.trim()) return;

    // Push telemetry stats into history
    const item = {
      question: questions[currentIdx].question,
      category: questions[currentIdx].category,
      answer: answer,
      eye_contact_scores: [...currentEyeContactScores.current],
      posture_scores: [...currentPostureScores.current],
      expression_log: [...currentExpressions.current]
    };

    const newHistory = [...history, item];
    setHistory(newHistory);

    // Reset current question telemetry buckets
    currentEyeContactScores.current = [];
    currentPostureScores.current = [];
    currentExpressions.current = [];
    setAnswer("");

    if (currentIdx + 1 < questions.length) {
      setCurrentIdx(currentIdx + 1);
    } else {
      // Completed last question. Stop stream and proceed to report compilation
      stopCameraAndWebSocket();
      compileFinalReport(newHistory);
    }
  };

  // Compile final report through Python backend (Gemini grading)
  const compileFinalReport = async (fullHistory) => {
    setLoading(true);
    setPhase("report");
    
    // Create telemetry timeline for graphs
    const timeline = [];
    fullHistory.forEach((item, index) => {
      const pScore = item.posture_scores.length ? Math.round(item.posture_scores.reduce((a, b) => a + b, 0) / item.posture_scores.length) : 90;
      const eScore = item.eye_contact_scores.length ? Math.round(item.eye_contact_scores.reduce((a, b) => a + b, 0) / item.eye_contact_scores.length) : 95;
      
      timeline.push({
        time: `Q${index + 1}`,
        posture: pScore,
        eyeContact: eScore
      });
    });
    setTelemetryTimeline(timeline);

    try {
      const res = await fetch(`${BACKEND_URL}/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: role,
          history: fullHistory,
          candidate_id: candidateId // Pass Candidate ID to save in Database
        })
      });

      if (!res.ok) {
        throw new Error("Failed to evaluate interview responses.");
      }

      const reportData = await res.json();
      setReport(reportData);
    } catch (err) {
      setError(err.message || "Failed to generate evaluation report.");
    } finally {
      setLoading(false);
    }
  };

  const handleRestart = () => {
    stopCameraAndWebSocket();
    setPhase("setup");
    setQuestions([]);
    setCurrentIdx(0);
    setAnswer("");
    setHistory([]);
    setReport(null);
    setFile(null);
    setTelemetryTimeline([]);
    setCandidateId(null);
    setCustomCandidateId("");
    setError(null);
  };

  return (
    <div className="min-h-screen flex flex-col justify-between">
      {/* Header */}
      <header className="border-b border-cyber-border py-4 px-6 md:px-12 flex justify-between items-center bg-cyber-bg/90 backdrop-blur-md sticky top-0 z-50 transition-colors duration-300">
        <div className="flex items-center space-x-3">
          <div className="relative p-2 bg-cyber-gold/10 rounded border border-cyber-gold/30">
            <Cpu className="h-6 w-6 text-cyber-gold" />
            <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-cyber-cyan pulse-cyan" />
          </div>
          <div>
            <h1 className="font-editorial text-2xl font-bold tracking-wider text-cyber-gold-light">AURA</h1>
            <p className="font-telemetry text-[10px] tracking-widest text-cyber-cyan opacity-80 uppercase">AI Diagnostic Interviewer</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          {phase === "interview" && (
            <div className="flex items-center space-x-2 border border-cyber-rose/30 bg-cyber-rose/10 px-3 py-1.5 rounded">
              <span className="w-2 h-2 rounded-full bg-cyber-rose animate-ping" />
              <span className="font-telemetry text-xs text-cyber-rose font-bold uppercase tracking-wider">Diagnostic Session Live</span>
            </div>
          )}
          
          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded border border-cyber-border hover:border-cyber-gold/50 bg-cyber-card text-cyber-gold hover:text-cyber-gold-light transition-all cursor-pointer shadow-sm"
            title={theme === "dark" ? "Toggle Light Mode" : "Toggle Dark Mode"}
          >
            {theme === "dark" ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-grow flex items-center justify-center p-4 md:p-8 w-full max-w-7xl mx-auto">
        
        {/* PHASE 1: SETUP SCREEN */}
        {phase === "setup" && (
          <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
            
            {/* Setup Form */}
            <div className="md:col-span-7 cyber-glass glow-gold rounded-lg p-6 md:p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 font-telemetry text-[10px] text-cyber-gold/40">SYS.INIT.db</div>
              
              <div className="mb-6">
                <h2 className="font-editorial text-2xl text-cyber-gold-light font-bold mb-1">Initialize Evaluation</h2>
                <p className="text-cyber-muted text-xs">
                  Upload your PDF resume and enter the target role. A team of LLM agents will generate custom behavioral and technical scenarios.
                </p>
              </div>

              {error && (
                <div className="mb-6 flex items-start space-x-3 bg-cyber-rose/15 border border-cyber-rose/40 rounded p-4 text-xs text-cyber-rose">
                  <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleStartSetup} className="space-y-4">
                {/* Target Job Role */}
                <div>
                  <label className="block font-telemetry text-[10px] uppercase tracking-wider text-cyber-gold mb-1">Target Professional Role</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Lead AI Architect, Senior React Developer"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full bg-cyber-bg/60 border border-cyber-border rounded px-4 py-2 text-cyber-primary placeholder-gray-600 focus:outline-none focus:border-cyber-cyan transition-colors text-sm"
                  />
                </div>

                {/* Candidate ID (Optional) */}
                <div>
                  <label className="block font-telemetry text-[10px] uppercase tracking-wider text-cyber-gold mb-1">Candidate ID (Optional)</label>
                  <input
                    type="number"
                    placeholder="Leave blank to generate a new ID, or type an existing ID"
                    value={customCandidateId}
                    onChange={(e) => setCustomCandidateId(e.target.value)}
                    className="w-full bg-cyber-bg/60 border border-cyber-border rounded px-4 py-2 text-cyber-primary placeholder-gray-600 focus:outline-none focus:border-cyber-cyan transition-colors text-sm"
                  />
                  <span className="text-[9px] text-cyber-muted mt-1 block font-telemetry">
                    Typing an existing ID links this new interview to that candidate profile.
                  </span>
                </div>

                {/* Drag and Drop Resume */}
                <div>
                  <label className="block font-telemetry text-[10px] uppercase tracking-wider text-cyber-gold mb-1">Resume Credentials (PDF)</label>
                  <div className="border border-dashed border-cyber-border rounded-lg bg-cyber-bg/40 p-4 text-center hover:border-cyber-gold/50 transition-colors relative group cursor-pointer">
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={handleFileChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    {file ? (
                      <div className="flex flex-col items-center space-y-2">
                        <div className="p-2 bg-cyber-gold/10 border border-cyber-gold rounded">
                          <FileText className="h-6 w-6 text-cyber-gold" />
                        </div>
                        <span className="text-cyber-primary font-medium text-xs truncate max-w-xs">{file.name}</span>
                        <span className="text-[10px] text-cyber-muted">{(file.size / 1024 / 1024).toFixed(2)} MB • PDF Document</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center space-y-2">
                        <div className="p-2 bg-cyber-border/10 rounded-full group-hover:bg-cyber-gold/10 transition-colors">
                          <UploadCloud className="h-6 w-6 text-cyber-muted group-hover:text-cyber-gold transition-colors" />
                        </div>
                        <div className="text-xs text-cyber-muted">
                          <span className="text-cyber-gold font-semibold">Click to upload</span> or drag and drop
                        </div>
                        <span className="text-[8px] text-cyber-muted">Secure parsing sandbox • PDF only</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-cyber-gold to-cyber-gold-light text-cyber-bg font-bold py-3 rounded hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-50 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="h-4.5 w-4.5 animate-spin" />
                      <span className="font-telemetry uppercase tracking-wider text-xs">Parsing Credentials...</span>
                    </>
                  ) : (
                    <>
                      <span className="font-telemetry uppercase tracking-wider text-xs font-black">Continue with Interview</span>
                      <ArrowRight className="h-4.5 w-4.5" />
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Archive / Search Lookups */}
            <div className="md:col-span-5 cyber-glass rounded-lg p-6 flex flex-col h-[490px] overflow-hidden">
              {/* Tab Switcher */}
              <div className="flex border-b border-cyber-border mb-4">
                <button
                  onClick={() => setLookupTab("archive")}
                  className={`pb-2.5 pr-4 font-telemetry text-xs uppercase tracking-wider flex items-center border-b-2 transition-all cursor-pointer ${
                    lookupTab === "archive" 
                      ? "border-cyber-gold text-cyber-gold font-bold" 
                      : "border-transparent text-cyber-muted hover:text-cyber-primary"
                  }`}
                >
                  <History className="h-4 w-4 mr-1.5" /> Archive
                </button>
                <button
                  onClick={() => setLookupTab("lookup")}
                  className={`pb-2.5 px-4 font-telemetry text-xs uppercase tracking-wider flex items-center border-b-2 transition-all cursor-pointer ${
                    lookupTab === "lookup" 
                      ? "border-cyber-gold text-cyber-gold font-bold" 
                      : "border-transparent text-cyber-muted hover:text-cyber-primary"
                  }`}
                >
                  <Search className="h-4 w-4 mr-1.5" /> ID Lookup
                </button>
              </div>

              {/* TAB 1: GLOBAL ARCHIVE */}
              {lookupTab === "archive" && (
                <div className="space-y-3 overflow-y-auto pr-1 grow">
                  {pastSessions.length > 0 ? (
                    pastSessions.map((session) => (
                      <div 
                        key={session.id} 
                        onClick={() => handleAccessPastReport(session.id)}
                        className="bg-cyber-bg/50 border border-cyber-border hover:border-cyber-cyan/50 hover:bg-cyber-bg/85 rounded p-3 cursor-pointer transition-all flex justify-between items-center group relative overflow-hidden"
                      >
                        <div className="pr-2 truncate">
                          <span className="font-telemetry text-[9px] text-cyber-muted uppercase block tracking-wider">{session.created_at}</span>
                          <h4 className="font-editorial text-sm font-bold text-cyber-primary truncate group-hover:text-cyber-cyan">{session.role}</h4>
                          <span className="font-telemetry text-[9px] text-cyber-gold">ID: {session.id} • {session.dominant_expression}</span>
                        </div>
                        
                        <div className="text-right flex items-center space-x-2 shrink-0">
                          <div className="bg-cyber-gold/10 border border-cyber-gold/30 px-2 py-1 rounded text-center min-w-[48px]">
                            <span className="block text-[8px] text-cyber-muted uppercase tracking-widest leading-none mb-0.5">Score</span>
                            <span className="font-telemetry text-xs font-bold text-cyber-gold">{session.composite_score}%</span>
                          </div>
                          
                          {/* Delete Button */}
                          <button
                            onClick={(e) => handleDeleteReport(e, session.id)}
                            className="p-1.5 rounded hover:bg-cyber-rose/10 text-cyber-muted hover:text-cyber-rose transition-colors cursor-pointer"
                            title="Delete record"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="h-60 flex flex-col items-center justify-center text-center text-cyber-muted">
                      <TrendingUp className="h-8 w-8 mb-2 opacity-30" />
                      <p className="text-xs">No evaluations stored in SQLite database.</p>
                      <span className="text-[10px] mt-1">Complete an evaluation to start database records.</span>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: CANDIDATE ID LOOKUP */}
              {lookupTab === "lookup" && (
                <div className="flex flex-col grow overflow-hidden">
                  {/* Lookup search bar */}
                  <form onSubmit={handleSearchCandidate} className="flex space-x-2 mb-4 shrink-0">
                    <input
                      type="number"
                      required
                      placeholder="Enter Candidate ID (e.g. 1)"
                      value={searchId}
                      onChange={(e) => setSearchId(e.target.value)}
                      className="bg-cyber-bg/60 border border-cyber-border rounded px-3 py-2 text-cyber-primary placeholder-gray-600 focus:outline-none focus:border-cyber-cyan transition-colors text-xs grow"
                    />
                    <button
                      type="submit"
                      disabled={loading}
                      className="bg-cyber-gold hover:opacity-90 text-cyber-bg font-bold px-4 rounded font-telemetry text-xs uppercase tracking-wider flex items-center cursor-pointer"
                    >
                      Search
                    </button>
                  </form>

                  {/* Search error */}
                  {searchError && (
                    <div className="bg-cyber-rose/15 border border-cyber-rose/40 rounded p-3 text-xs text-cyber-rose flex items-start space-x-2 mb-3">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>{searchError}</span>
                    </div>
                  )}

                  {/* Searched candidate results */}
                  <div className="grow overflow-y-auto space-y-3 pr-1">
                    {searchedCandidate ? (
                      <div className="space-y-3">
                        <div className="bg-cyber-cyan/5 border border-cyber-cyan/20 rounded p-3 mb-2 flex items-center justify-between">
                          <div>
                            <span className="font-telemetry text-[9px] text-cyber-cyan uppercase block tracking-wider">Candidate Profile Found</span>
                            <span className="font-editorial text-sm font-bold text-cyber-primary">Role: {searchedCandidate.role}</span>
                          </div>
                          <div className="bg-cyber-cyan/15 border border-cyber-cyan/40 px-2 py-0.5 rounded text-[10px] text-cyber-cyan font-mono">
                            ID: {searchedCandidate.candidate_id}
                          </div>
                        </div>

                        {searchedCandidate.history.length > 0 ? (
                          searchedCandidate.history.map((session) => (
                            <div 
                              key={session.id} 
                              onClick={() => handleAccessPastReport(session.id)}
                              className="bg-cyber-bg/50 border border-cyber-border hover:border-cyber-cyan/50 hover:bg-cyber-bg/85 rounded p-3 cursor-pointer transition-all flex justify-between items-center group relative overflow-hidden"
                            >
                              <div className="pr-2 truncate">
                                <span className="font-telemetry text-[9px] text-cyber-muted uppercase block tracking-wider">{session.created_at}</span>
                                <h4 className="font-editorial text-xs font-bold text-cyber-primary truncate group-hover:text-cyber-cyan">{session.role}</h4>
                                <span className="font-telemetry text-[9px] text-cyber-gold">Session ID: {session.id}</span>
                              </div>
                              
                              <div className="text-right flex items-center space-x-2 shrink-0">
                                <div className="bg-cyber-gold/10 border border-cyber-gold/30 px-2 py-1 rounded text-center min-w-[48px]">
                                  <span className="block text-[8px] text-cyber-muted uppercase tracking-widest leading-none mb-0.5">Score</span>
                                  <span className="font-telemetry text-xs font-bold text-cyber-gold">{session.composite_score}%</span>
                                </div>
                                
                                <button
                                  onClick={(e) => handleDeleteReport(e, session.id)}
                                  className="p-1.5 rounded hover:bg-cyber-rose/10 text-cyber-muted hover:text-cyber-rose transition-colors cursor-pointer"
                                  title="Delete record"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="h-40 flex flex-col items-center justify-center text-center text-cyber-muted">
                            <TrendingUp className="h-8 w-8 mb-2 opacity-30" />
                            <p className="text-xs">No evaluations registered for this candidate yet.</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      !searchError && (
                        <div className="h-60 flex flex-col items-center justify-center text-center text-cyber-muted">
                          <UserCheck className="h-8 w-8 mb-2 opacity-30" />
                          <p className="text-xs">Input Candidate ID above to fetch historical profiles.</p>
                          <span className="text-[9px] mt-1 font-telemetry">Recruiter Dashboard Query System</span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* PHASE 2: LIVE INTERVIEW ROOM */}
        {phase === "interview" && questions.length > 0 && (
          <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            
            {/* Left Column: Webcam & Telemetry */}
            <div className="lg:col-span-5 flex flex-col space-y-4">
              {/* Webcam Preview Container */}
              <div className="relative border border-cyber-border bg-cyber-bg/60 rounded-lg overflow-hidden aspect-video w-full shadow-lg">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover scale-x-[-1]"
                />
                <canvas
                  ref={canvasRef}
                  width="640"
                  height="480"
                  className="hidden"
                />
                
                {/* HUD Matrix Overlay */}
                <div className="absolute top-3 left-3 flex items-center space-x-2 border border-cyber-cyan/30 bg-cyber-bg/70 px-2 py-1 rounded">
                  <span className="w-2 h-2 rounded-full bg-cyber-cyan pulse-cyan" />
                  <span className="font-telemetry text-[9px] text-cyber-cyan tracking-widest uppercase">Cam stream active</span>
                </div>
                
                <div className="absolute bottom-3 right-3 font-telemetry text-[9px] text-cyber-muted tracking-wider">
                  640x480 | 15fps | h264
                </div>
              </div>

              {/* Real-time Telemetry Dashboard */}
              <div className="cyber-glass rounded-lg p-5 flex flex-col space-y-4 flex-grow justify-center">
                <h3 className="font-telemetry text-xs uppercase tracking-wider text-cyber-gold border-b border-cyber-border pb-2 flex items-center">
                  <Activity className="h-4 w-4 mr-2 text-cyber-cyan" />
                  Biometric Telemetry HUD
                </h3>

                {/* Grid metrics */}
                <div className="grid grid-cols-3 gap-3">
                  {/* Metric: Posture */}
                  <div className="bg-cyber-bg/50 border border-cyber-border p-3 rounded text-center">
                    <div className="flex justify-center mb-1">
                      <Video className={`h-5 w-5 ${liveMetrics.posture === "Good" ? "text-cyber-emerald" : "text-cyber-rose"}`} />
                    </div>
                    <span className="block text-[10px] uppercase text-cyber-muted font-telemetry tracking-wide">Posture</span>
                    <span className="font-telemetry text-xs font-bold text-cyber-primary">{liveMetrics.posture}</span>
                  </div>

                  {/* Metric: Eye Contact */}
                  <div className="bg-cyber-bg/50 border border-cyber-border p-3 rounded text-center">
                    <div className="flex justify-center mb-1">
                      <Eye className={`h-5 w-5 ${liveMetrics.eye_contact ? "text-cyber-emerald" : "text-cyber-rose animate-pulse"}`} />
                    </div>
                    <span className="block text-[10px] uppercase text-cyber-muted font-telemetry tracking-wide">Eye Contact</span>
                    <span className="font-telemetry text-xs font-bold text-cyber-primary">
                      {liveMetrics.eye_contact ? "Stable" : "Away"}
                    </span>
                  </div>

                  {/* Metric: Expression */}
                  <div className="bg-cyber-bg/50 border border-cyber-border p-3 rounded text-center">
                    <div className="flex justify-center mb-1">
                      <Smile className="h-5 w-5 text-cyber-gold" />
                    </div>
                    <span className="block text-[10px] uppercase text-cyber-muted font-telemetry tracking-wide">Expression</span>
                    <span className="font-telemetry text-xs font-bold text-cyber-primary">{liveMetrics.expression}</span>
                  </div>
                </div>

                {/* Telemetry warnings */}
                {liveMetrics.feedback.length > 0 ? (
                  <div className="bg-cyber-rose/10 border border-cyber-rose/30 rounded p-3 text-xs text-cyber-rose flex items-start space-x-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 animate-bounce" />
                    <div className="flex flex-col">
                      <span className="font-bold font-telemetry uppercase tracking-wider text-[9px] mb-0.5">Biometric Correction Warning</span>
                      {liveMetrics.feedback.map((f, i) => <p key={i}>{f}</p>)}
                    </div>
                  </div>
                ) : (
                  <div className="bg-cyber-emerald/10 border border-cyber-emerald/30 rounded p-3 text-xs text-cyber-emerald flex items-center space-x-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <div className="flex flex-col">
                      <span className="font-bold font-telemetry uppercase tracking-wider text-[9px] mb-0.5">Telemetry Status Nominal</span>
                      <p>Calibrated alignment and focus detected.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: AI Interview Board */}
            <div className="lg:col-span-7 flex flex-col justify-between cyber-glass rounded-lg p-6 relative overflow-hidden">
              <div className="flex justify-between items-center border-b border-cyber-border pb-4 mb-6">
                <div>
                  <span className="font-telemetry text-xs text-cyber-gold uppercase tracking-widest">{questions[currentIdx].category} Question</span>
                  <h3 className="font-editorial text-lg text-cyber-gold-light">Candidate Response Terminal</h3>
                </div>
                <div className="bg-cyber-bg border border-cyber-border px-3 py-1 rounded font-telemetry text-xs text-cyber-cyan">
                  Q {currentIdx + 1} / {questions.length}
                </div>
              </div>

              {/* Main Question Body */}
              <div className="bg-cyber-bg/40 border border-cyber-border rounded-lg p-6 mb-6 grow flex flex-col justify-center min-h-[160px]">
                <blockquote className="font-editorial text-xl md:text-2xl text-cyber-primary font-bold leading-relaxed text-center italic">
                  "{questions[currentIdx].question}"
                </blockquote>
                
                {/* Expected Keywords HUD */}
                <div className="mt-6 flex flex-wrap gap-2 justify-center">
                  <span className="font-telemetry text-[10px] text-cyber-muted uppercase tracking-widest self-center mr-1">Context Keywords:</span>
                  {questions[currentIdx].expected_keywords.map((kw, i) => (
                    <span key={i} className="font-telemetry text-[10px] border border-cyber-gold/20 bg-cyber-gold/5 px-2.5 py-0.5 rounded text-cyber-gold">
                      {kw}
                    </span>
                  ))}
                </div>
              </div>

              {/* Answer Input Area */}
              <div className="space-y-4">
                <div>
                  <label className="block font-telemetry text-xs uppercase tracking-wider text-cyber-gold mb-2">Formulate Response</label>
                  <textarea
                    rows={6}
                    placeholder="Structure your answer clearly. Feel free to explain architecture, specific experiences, or methodologies."
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    className="w-full bg-cyber-bg/60 border border-cyber-border rounded p-4 text-cyber-primary placeholder-gray-600 focus:outline-none focus:border-cyber-cyan transition-colors resize-none font-sans text-sm md:text-base"
                  />
                </div>

                <div className="flex justify-between items-center">
                  <span className="font-telemetry text-xs text-cyber-muted">
                    Characters: {answer.length}
                  </span>
                  
                  <button
                    onClick={handleSubmitAnswer}
                    disabled={!answer.trim()}
                    className="flex items-center space-x-2 bg-gradient-to-r from-cyber-gold to-cyber-gold-light text-cyber-bg font-bold px-6 py-3 rounded hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                  >
                    <span className="font-telemetry uppercase tracking-wider text-xs font-black">
                      {currentIdx + 1 === questions.length ? "Submit & Compile Report" : "Next Question"}
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PHASE 3: EVALUATION REPORT DASHBOARD */}
        {phase === "report" && (
          <div className="w-full max-w-5xl space-y-8">
            {loading ? (
              <div className="cyber-glass rounded-lg p-12 text-center flex flex-col items-center justify-center space-y-6 glow-gold">
                <div className="relative p-4 bg-cyber-gold/5 border border-cyber-gold/30 rounded-full">
                  <RefreshCw className="h-10 w-10 text-cyber-gold animate-spin" />
                  <Sparkles className="absolute top-1 right-1 h-4 w-4 text-cyber-cyan animate-pulse" />
                </div>
                <div>
                  <h2 className="font-editorial text-2xl font-bold text-cyber-gold-light mb-2">Compiling Biometric & Answer Diagnostics</h2>
                  <p className="text-cyber-muted text-sm max-w-md mx-auto">
                    Analyzing communication structure and cross-referencing biometric logs with LLM-graded answer grids. This takes around 10-15 seconds.
                  </p>
                </div>
              </div>
            ) : report ? (
              <div className="space-y-8">
                {/* Score Banner */}
                <div className="cyber-glass rounded-lg p-6 md:p-8 flex flex-col md:flex-row items-center justify-between border-l-4 border-l-cyber-gold relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 font-telemetry text-xs text-cyber-gold/30">
                    REPORT.ID: {report.id || "Live"} • CANDIDATE.ID: {candidateId || report.candidate_id || "Unsaved"}
                  </div>
                  
                  <div className="text-center md:text-left mb-6 md:mb-0">
                    <span className="font-telemetry text-xs uppercase tracking-widest text-cyber-cyan">{report.role} Candidate Profile</span>
                    <h2 className="font-editorial text-3xl font-bold text-cyber-gold-light mt-1">Diagnostic Report</h2>
                    <p className="text-cyber-muted text-xs mt-2 flex items-center justify-center md:justify-start">
                      <Clock className="h-3 w-3 mr-1 text-cyber-gold" /> Session Completed • {report.created_at || "Compiled Live"}
                    </p>
                  </div>

                  {/* Composite Score Ring */}
                  <div className="relative flex items-center justify-center w-36 h-36 border border-cyber-border rounded-full bg-cyber-bg/40">
                    <div className="absolute inset-2 border border-dashed border-cyber-gold/40 rounded-full animate-spin" style={{ animationDuration: '40s' }} />
                    <div className="text-center">
                      <span className="font-telemetry text-[36px] font-black text-cyber-gold-light leading-none">{report.composite_score}%</span>
                      <span className="block font-telemetry text-[9px] uppercase tracking-wider text-cyber-cyan mt-1">COMPOSITE GRADE</span>
                    </div>
                  </div>
                </div>

                {/* Graphs and Metrics Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Radar Metric Profile */}
                  <div className="cyber-glass rounded-lg p-6">
                    <h3 className="font-telemetry text-xs uppercase tracking-wider text-cyber-gold border-b border-cyber-border pb-3 mb-6">
                      Candidate Performance Profile
                    </h3>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={[
                          { subject: 'Technical', A: report.content_score },
                          { subject: 'Eye Contact', A: report.eye_contact_score },
                          { subject: 'Posture', A: report.posture_score },
                          { subject: 'Expressions', A: report.dominant_expression === "Neutral" || report.dominant_expression === "Smiling" || report.dominant_expression === "Focused" ? 95 : 70 },
                          { subject: 'Communication', A: Math.round((report.content_score + report.eye_contact_score) / 2) }
                        ]}>
                          <PolarGrid stroke="#c5a85c" opacity={0.15} />
                          <PolarAngleAxis dataKey="subject" stroke="#9ca3af" fontSize={11} tickLine={false} />
                          <PolarRadiusAxis stroke="#c5a85c" opacity={0.3} angle={30} domain={[0, 100]} />
                          <Radar name="Candidate" dataKey="A" stroke="#00f2fe" fill="#00f2fe" fillOpacity={0.15} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Telemetry Timeline */}
                  <div className="cyber-glass rounded-lg p-6">
                    <h3 className="font-telemetry text-xs uppercase tracking-wider text-cyber-gold border-b border-cyber-border pb-3 mb-6">
                      Biometric Performance Timeline
                    </h3>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={telemetryTimeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorEye" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#00f2fe" stopOpacity={0.2}/>
                              <stop offset="95%" stopColor="#00f2fe" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorPos" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#c5a85c" stopOpacity={0.2}/>
                              <stop offset="95%" stopColor="#c5a85c" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(197, 168, 92, 0.05)" />
                          <XAxis dataKey="time" stroke="#9ca3af" fontSize={10} />
                          <YAxis stroke="#9ca3af" fontSize={10} domain={[0, 100]} />
                          <Tooltip contentStyle={{ backgroundColor: "var(--color-cyber-card)", border: "1px solid rgba(197, 168, 92, 0.2)", borderRadius: 4 }} />
                          <Area type="monotone" dataKey="eyeContact" name="Eye Contact Score" stroke="#00f2fe" fillOpacity={1} fill="url(#colorEye)" />
                          <Area type="monotone" dataKey="posture" name="Posture Score" stroke="#c5a85c" fillOpacity={1} fill="url(#colorPos)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Key Insights (Strengths & Weaknesses) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Strengths */}
                  <div className="bg-cyber-emerald/5 border border-cyber-emerald/10 rounded-lg p-5">
                    <h4 className="font-telemetry text-xs uppercase tracking-wider text-cyber-emerald flex items-center mb-3">
                      <ShieldCheck className="h-4.5 w-4.5 mr-2" /> Key Strengths
                    </h4>
                    <ul className="space-y-2 text-sm text-cyber-primary">
                      {report.strengths.map((str, i) => (
                        <li key={i} className="flex items-start">
                          <CheckCircle2 className="h-4 w-4 text-cyber-emerald shrink-0 mt-0.5 mr-2" />
                          <span>{str}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Weaknesses / Improvements */}
                  <div className="bg-cyber-rose/5 border border-cyber-rose/10 rounded-lg p-5">
                    <h4 className="font-telemetry text-xs uppercase tracking-wider text-cyber-rose flex items-center mb-3">
                      <AlertTriangle className="h-4.5 w-4.5 mr-2" /> Identified Weaknesses
                    </h4>
                    <ul className="space-y-2 text-sm text-cyber-primary">
                      {report.weaknesses.map((weak, i) => (
                        <li key={i} className="flex items-start">
                          <AlertTriangle className="h-4 w-4 text-cyber-rose shrink-0 mt-0.5 mr-2" />
                          <span>{weak}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Per-Question Detailed Analysis */}
                <div className="space-y-4">
                  <h3 className="font-telemetry text-xs uppercase tracking-wider text-cyber-gold border-b border-cyber-border pb-3">
                    Granular Answer Diagnostics
                  </h3>
                  
                  {report.detailed_evaluations.map((evalItem, index) => (
                    <div key={index} className="cyber-glass rounded-lg p-5 md:p-6 space-y-4">
                      <div className="flex justify-between items-start border-b border-cyber-border pb-3">
                        <div className="pr-4">
                          <span className="font-telemetry text-[10px] text-cyber-cyan uppercase tracking-widest">Question {index + 1}</span>
                          <p className="font-editorial text-base font-bold text-cyber-primary mt-1">
                            "{report.history_transcript ? report.history_transcript[index].question : history[index].question}"
                          </p>
                        </div>
                        <div className="bg-cyber-bg/85 border border-cyber-border px-3 py-1 rounded font-telemetry text-sm text-cyber-gold">
                          Grade: {evalItem.score}%
                        </div>
                      </div>

                      {/* Candidate Answer */}
                      <div className="bg-cyber-bg/40 p-4 rounded border border-cyber-border/40 text-sm text-cyber-muted">
                        <span className="font-telemetry text-[9px] uppercase tracking-wider block text-cyber-muted mb-1">Your response:</span>
                        "{report.history_transcript ? report.history_transcript[index].answer : history[index].answer}"
                      </div>

                      {/* Diagnostic Feedback */}
                      <div className="text-sm text-cyber-primary space-y-1">
                        <span className="font-telemetry text-[9px] uppercase tracking-wider block text-cyber-gold">Manager Feedback:</span>
                        <p>{evalItem.feedback}</p>
                      </div>

                      {/* Ideal Model Answer */}
                      <div className="bg-cyber-gold/5 p-4 rounded border border-cyber-gold/15 text-sm text-cyber-primary">
                        <span className="font-telemetry text-[9px] uppercase tracking-wider block text-cyber-gold-light font-bold mb-1">Ideal Model Answer Structure:</span>
                        <p className="italic">"{evalItem.sample_ideal_answer}"</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Restart CTA */}
                <div className="text-center py-6">
                  {candidateId && (
                    <div className="mb-4 text-xs text-cyber-gold font-telemetry uppercase tracking-widest bg-cyber-gold/5 border border-cyber-gold/20 inline-block px-4 py-2 rounded">
                      Profile Saved Successfully! Use ID: <span className="font-bold font-editorial text-sm text-cyber-gold-light">{candidateId}</span> to search or link future runs.
                    </div>
                  )}
                  <br />
                  <button
                    onClick={handleRestart}
                    className="inline-flex items-center space-x-2 border border-cyber-gold/50 bg-cyber-gold/10 text-cyber-gold-light hover:bg-cyber-gold/20 font-bold px-8 py-3.5 rounded transition-all active:scale-[0.98] cursor-pointer"
                  >
                    <RefreshCw className="h-4.5 w-4.5" />
                    <span className="font-telemetry uppercase tracking-wider text-xs">Run Another Evaluation</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="cyber-glass rounded-lg p-12 text-center text-cyber-rose">
                <AlertTriangle className="h-10 w-10 mx-auto mb-4" />
                <p>Failed to generate evaluation report. Please make sure the backend is active.</p>
                <button onClick={handleRestart} className="mt-4 px-4 py-2 border border-cyber-rose rounded text-sm cursor-pointer">
                  Restart System
                </button>
              </div>
            )}
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-cyber-border py-4 px-6 md:px-12 flex flex-col md:flex-row justify-between items-center bg-cyber-bg/40 font-telemetry text-[9px] text-cyber-muted tracking-wider">
        <span>AURA DIAGNOSTICS INC. © 2026 • PRIVACY PARSED SECURE DATA</span>
        <span className="flex items-center mt-2 md:mt-0">
          <Terminal className="h-3 w-3 mr-1 text-cyber-cyan" /> TERMINAL INTERACTION ACTIVE
        </span>
      </footer>
    </div>
  );
}
