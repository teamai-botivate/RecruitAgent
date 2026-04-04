import React, { useState, useEffect, useRef } from 'react';
import { Camera, Clock, AlertTriangle, Code, CheckCircle, Monitor, Play, ChevronLeft, ChevronRight, Flag, Send, BookOpen, Terminal, Loader } from 'lucide-react';

const TestEnvironment = () => {
  const apiBase = window.__API_BASE || 'http://localhost:8000';
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token') || '';

  const [phase, setPhase] = useState('verify');
  const [testData, setTestData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  const videoRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');

  const [timeLeft, setTimeLeft] = useState(3600);
  const timerRef = useRef(null);

  const [tabSwitches, setTabSwitches] = useState(0);
  const [fullscreenExits, setFullscreenExits] = useState(0);
  const [cameraDenied, setCameraDenied] = useState(0);
  const [faceMissingEvents, setFaceMissingEvents] = useState(0);
  const [faceOutOfFrameEvents, setFaceOutOfFrameEvents] = useState(0);
  const [multiFaceEvents, setMultiFaceEvents] = useState(0);
  const [longFaceMissingEvents, setLongFaceMissingEvents] = useState(0);
  const [faceTrackingState, setFaceTrackingState] = useState('Initializing');
  const [faceTrackingSupported, setFaceTrackingSupported] = useState(typeof window !== 'undefined' && 'FaceDetector' in window);
  const [warnings, setWarnings] = useState([]);
  const [proctoringEvents, setProctoringEvents] = useState([]);

  const faceDetectorRef = useRef(null);
  const faceCheckIntervalRef = useRef(null);
  const faceDetectBusyRef = useRef(false);
  const missingSecondsRef = useRef(0);
  const offFrameSecondsRef = useRef(0);
  const multiFaceActiveRef = useRef(false);
  const faceMissingMinorRaisedRef = useRef(false);
  const faceMissingMajorRaisedRef = useRef(false);
  const faceOffMinorRaisedRef = useRef(false);
  const faceOffHighRaisedRef = useRef(false);

  const [mcqAnswers, setMcqAnswers] = useState({});
  const [codingAnswers, setCodingAnswers] = useState({});
  const [codingLanguages, setCodingLanguages] = useState({});
  const [codeResults, setCodeResults] = useState({});
  const [runningCode, setRunningCode] = useState({});
  const [flaggedQuestions, setFlaggedQuestions] = useState({});

  const [currentSection, setCurrentSection] = useState('mcq');
  const [currentQ, setCurrentQ] = useState(0);
  const [email, setEmail] = useState('');
  const [verifiedEmail, setVerifiedEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [starting, setStarting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const VIOLATION_LIMIT = 3;
  const [violationCount, setViolationCount] = useState(0);
  const [faceDirectionCounts, setFaceDirectionCounts] = useState({ left: 0, right: 0, up: 0, down: 0 });

  const violationCountRef = useRef(0);
  const autoSubmittedForViolationRef = useRef(false);
  const offDirectionRef = useRef(null);

  useEffect(() => {
    violationCountRef.current = violationCount;
  }, [violationCount]);

  const computeViolationStatus = () => {
    if (
      violationCount >= VIOLATION_LIMIT ||
      cameraDenied > 0 ||
      tabSwitches >= 5 ||
      fullscreenExits >= 3 ||
      multiFaceEvents > 0 ||
      longFaceMissingEvents > 0
    ) {
      return 'Major Violation';
    }
    if (
      tabSwitches >= 3 ||
      fullscreenExits >= 2 ||
      faceMissingEvents >= 2 ||
      faceOutOfFrameEvents >= 3
    ) {
      return 'Suspicious';
    }
    if (
      tabSwitches > 0 ||
      fullscreenExits > 0 ||
      faceMissingEvents > 0 ||
      faceOutOfFrameEvents > 0
    ) {
      return 'Minor Violation';
    }
    return 'Normal';
  };

  const recordProctorEvent = (eventType, severity, details) => {
    setProctoringEvents(prev => ([
      ...prev,
      {
        event_type: eventType,
        severity,
        details,
        event_time: new Date().toISOString(),
      }
    ]));
  };

  const classifyFaceDirection = (faceBox, video) => {
    if (!faceBox || !video || !video.videoWidth || !video.videoHeight) return 'unknown';

    const centerX = (faceBox.x + (faceBox.width / 2)) / video.videoWidth;
    const centerY = (faceBox.y + (faceBox.height / 2)) / video.videoHeight;

    if (centerX < 0.35) return 'left';
    if (centerX > 0.65) return 'right';
    if (centerY < 0.30) return 'up';
    if (centerY > 0.74) return 'down';
    return 'center';
  };

  const registerViolation = (eventType, severity, details) => {
    setWarnings(prev => [...prev.slice(-9), `⚠️ ${details}`]);
    recordProctorEvent(eventType, severity, details);

    setViolationCount(prev => {
      const next = prev + 1;
      if (next >= VIOLATION_LIMIT && !autoSubmittedForViolationRef.current) {
        autoSubmittedForViolationRef.current = true;
        setTimeout(() => {
          handleAutoSubmit('violation_limit');
        }, 0);
      }
      return next;
    });
  };

  // Mobile check
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 900 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Fetch test data
  useEffect(() => {
    if (!token) { setLoading(false); return; }
    fetch(`${apiBase}/test/get-assessment/${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.detail) { setLoading(false); return; }
        setTestData(data);
        setTimeLeft((data.duration_minutes || 60) * 60);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [token, apiBase]);

  // Tab switch and fullscreen detection
  useEffect(() => {
    if (phase !== 'test') return;
    const visibilityHandler = () => {
      if (document.hidden) {
        setTabSwitches(prev => {
          const n = prev + 1;
          registerViolation('tab_switch', 'high', `Tab switch #${n} at ${new Date().toLocaleTimeString()}`);
          return n;
        });
      }
    };
    
    const fullscreenHandler = () => {
      if (!document.fullscreenElement) {
        setFullscreenExits(prev => {
          const n = prev + 1;
          registerViolation('fullscreen_exit', 'high', `Exited fullscreen (warning #${n}) at ${new Date().toLocaleTimeString()}`);
          return n;
        });
        alert('⚠️ You exited fullscreen. This is recorded as a proctoring violation. Please return to fullscreen immediately.');
      }
    };

    document.addEventListener('visibilitychange', visibilityHandler);
    document.addEventListener('fullscreenchange', fullscreenHandler);
    
    return () => {
      document.removeEventListener('visibilitychange', visibilityHandler);
      document.removeEventListener('fullscreenchange', fullscreenHandler);
    };
  }, [phase]);

  // Timer
  useEffect(() => {
    if (phase !== 'test') return;
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(timerRef.current); handleAutoSubmit(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [phase]);

  // Re-attach camera stream when the test UI video element mounts.
  useEffect(() => {
    if (phase !== 'test' || !cameraActive) return;
    if (videoRef.current && mediaStreamRef.current && videoRef.current.srcObject !== mediaStreamRef.current) {
      videoRef.current.srcObject = mediaStreamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [phase, cameraActive]);

  const isFaceCentered = (faceBox, video) => {
    if (!faceBox || !video || !video.videoWidth || !video.videoHeight) return false;

    const centerX = (faceBox.x + (faceBox.width / 2)) / video.videoWidth;
    const centerY = (faceBox.y + (faceBox.height / 2)) / video.videoHeight;
    const areaRatio = (faceBox.width * faceBox.height) / (video.videoWidth * video.videoHeight);

    const horizontalInRange = centerX >= 0.2 && centerX <= 0.8;
    const verticalInRange = centerY >= 0.2 && centerY <= 0.82;
    const sizeInRange = areaRatio >= 0.02 && areaRatio <= 0.65;

    return horizontalInRange && verticalInRange && sizeInRange;
  };

  useEffect(() => {
    if (phase !== 'test' || !cameraActive) return;

    if (!window.ml5) {
      setFaceTrackingSupported(false);
      setFaceTrackingState('Unsupported');
      return;
    }

    setFaceTrackingSupported(true);
    setFaceTrackingState('Initializing...');

    let poseNet;
    const initPoseNet = async () => {
      try {
        poseNet = await window.ml5.poseNet(videoRef.current, { maxPoseDetections: 2 });
      } catch (err) {
        console.error('PoseNet init failed:', err);
        setFaceTrackingSupported(false);
        setFaceTrackingState('Tracking unavailable');
      }
    };

    initPoseNet();

    faceCheckIntervalRef.current = setInterval(async () => {
      if (faceDetectBusyRef.current || !poseNet || !videoRef.current) return;

      faceDetectBusyRef.current = true;
      try {
        const poses = await poseNet.estimateSinglePose(videoRef.current, { flipHorizontal: true });
        const pose = poses?.pose;

        if (!pose || !pose.keypoints || pose.keypoints.length === 0) {
          setFaceTrackingState('Face not detected');
          missingSecondsRef.current += 1;
          offFrameSecondsRef.current = 0;
          faceOffMinorRaisedRef.current = false;
          faceOffHighRaisedRef.current = false;
          multiFaceActiveRef.current = false;

          if (missingSecondsRef.current >= 3 && !faceMissingMinorRaisedRef.current) {
            faceMissingMinorRaisedRef.current = true;
            setFaceMissingEvents(prev => prev + 1);
            registerViolation('face_missing', 'medium', `Face not visible for ${missingSecondsRef.current}s`);
          }

          if (missingSecondsRef.current >= 10 && !faceMissingMajorRaisedRef.current) {
            faceMissingMajorRaisedRef.current = true;
            setLongFaceMissingEvents(prev => prev + 1);
            registerViolation('face_missing_long', 'critical', `Face absent for ${missingSecondsRef.current}s`);
          }
          return;
        }

        const nose = pose.keypoints.find(kp => kp.part === 'nose');
        const leftEye = pose.keypoints.find(kp => kp.part === 'leftEye');
        const rightEye = pose.keypoints.find(kp => kp.part === 'rightEye');
        const leftEar = pose.keypoints.find(kp => kp.part === 'leftEar');
        const rightEar = pose.keypoints.find(kp => kp.part === 'rightEar');

        const MIN_CONFIDENCE = 0.3;
        const bothEyesVisible = leftEye?.score > MIN_CONFIDENCE && rightEye?.score > MIN_CONFIDENCE;
        const bothEarsVisible = leftEar?.score > MIN_CONFIDENCE && rightEar?.score > MIN_CONFIDENCE;

        if (!bothEyesVisible) {
          if (!faceMissingMinorRaisedRef.current) {
            faceMissingMinorRaisedRef.current = true;
            registerViolation('eyes_not_visible', 'medium', `Eyes are not both visible`);
          }
        } else {
          faceMissingMinorRaisedRef.current = false;
        }

        if (!bothEarsVisible) {
          if (!faceMissingMajorRaisedRef.current) {
            faceMissingMajorRaisedRef.current = true;
            registerViolation('ears_not_visible', 'medium', `Ears are not both visible`);
          }
        } else {
          faceMissingMajorRaisedRef.current = false;
        }

        if (nose?.score > MIN_CONFIDENCE) {
          const video = videoRef.current;
          const centerX = nose.position.x / video.videoWidth;
          const centerY = nose.position.y / video.videoHeight;

          let direction = 'center';
          if (centerX < 0.35) direction = 'left';
          else if (centerX > 0.65) direction = 'right';
          else if (centerY < 0.30) direction = 'up';
          else if (centerY > 0.74) direction = 'down';

          if (direction !== 'center') {
            setFaceTrackingState(`Face ${direction}`);

            if (offDirectionRef.current !== direction) {
              offDirectionRef.current = direction;
              offFrameSecondsRef.current = 0;
              faceOffMinorRaisedRef.current = false;
              faceOffHighRaisedRef.current = false;
            }

            offFrameSecondsRef.current += 1;

            if (offFrameSecondsRef.current >= 3 && !faceOffMinorRaisedRef.current) {
              faceOffMinorRaisedRef.current = true;
              setFaceOutOfFrameEvents(prev => prev + 1);
              setFaceDirectionCounts(prev => ({ ...prev, [direction]: (prev[direction] || 0) + 1 }));
              registerViolation(`face_${direction}`, 'medium', `Face moved ${direction} for ${offFrameSecondsRef.current}s`);
            }

            if (offFrameSecondsRef.current >= 8 && !faceOffHighRaisedRef.current) {
              faceOffHighRaisedRef.current = true;
              setFaceOutOfFrameEvents(prev => prev + 1);
              setFaceDirectionCounts(prev => ({ ...prev, [direction]: (prev[direction] || 0) + 1 }));
              registerViolation(`face_${direction}_long`, 'high', `Face remained ${direction} for too long (${offFrameSecondsRef.current}s)`);
            }
            return;
          }

          setFaceTrackingState('Face aligned');
          offDirectionRef.current = null;
          offFrameSecondsRef.current = 0;
          faceOffMinorRaisedRef.current = false;
          faceOffHighRaisedRef.current = false;
          missingSecondsRef.current = 0;
        }
      } catch (err) {
        setFaceTrackingState('Tracking paused');
      } finally {
        faceDetectBusyRef.current = false;
      }
    }, 1000);

    return () => {
      if (faceCheckIntervalRef.current) {
        clearInterval(faceCheckIntervalRef.current);
        faceCheckIntervalRef.current = null;
      }
      if (poseNet) {
        poseNet.dispose?.();
      }
    };
  }, [phase, cameraActive]);

  useEffect(() => {
    return () => {
      if (faceCheckIntervalRef.current) {
        clearInterval(faceCheckIntervalRef.current);
        faceCheckIntervalRef.current = null;
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
    };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setCameraActive(true);
      setCameraError('');
      recordProctorEvent('camera_enabled', 'info', 'Candidate granted webcam access');
    } catch (e) {
      setCameraError('Camera access denied. Camera is required to proceed.');
      setCameraDenied(prev => prev + 1);
      recordProctorEvent('camera_denied', 'critical', 'Candidate denied webcam access');
    }
  };

  const handleStartTest = async () => {
    if (!email) return alert('Please enter your email to begin');

    setStarting(true);
    const enteredEmail = String(email || '').trim();

    try {
      const verifyResp = await fetch(`${apiBase}/test/verify-candidate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, email: enteredEmail }),
      });

      const verifyData = await verifyResp.json();
      if (!verifyResp.ok) {
        throw new Error(verifyData.detail || 'This email is not authorized for this test link');
      }

      const canonical = verifyData.canonical_email || enteredEmail.toLowerCase();
      setVerifiedEmail(canonical);
      setEmail(canonical);
    } catch (e) {
      alert(e.message || 'Verification failed. Please check your email and test link.');
      setStarting(false);
      return;
    }

    await startCamera();
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch (e) {
      console.warn("Fullscreen request failed", e);
    }
    setPhase('test');
    setStarting(false);
  };

  const formatTime = (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const handleMcqAnswer = (qIdx, answer) => setMcqAnswers(prev => ({ ...prev, [qIdx]: answer }));
  const handleCodingAnswer = (qIdx, code) => setCodingAnswers(prev => ({ ...prev, [qIdx]: code }));
  const handleLanguageChange = (qIdx, lang) => setCodingLanguages(prev => ({ ...prev, [qIdx]: lang }));
  const toggleFlag = (key) => setFlaggedQuestions(prev => ({ ...prev, [key]: !prev[key] }));

  // Run code against test cases
  const handleRunCode = async (qIdx) => {
    const cq = codingQs[qIdx];
    const code = codingAnswers[qIdx] || '';
    const lang = codingLanguages[qIdx] || 'python';

    if (!code.trim()) return alert('Write some code first!');

    setRunningCode(prev => ({ ...prev, [qIdx]: true }));
    try {
      const resp = await fetch(`${apiBase}/test/run-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problem_text: `${cq.title}\n${cq.description}\nConstraints: ${cq.constraints || ''}`,
          code,
          language: lang,
          test_cases: cq.test_cases || [],
        })
      });
      const result = await resp.json();
      setCodeResults(prev => ({ ...prev, [qIdx]: result }));
    } catch (e) {
      setCodeResults(prev => ({ ...prev, [qIdx]: { error: e.message, results: [], passed_count: 0, total_count: (cq.test_cases || []).length } }));
    } finally {
      setRunningCode(prev => ({ ...prev, [qIdx]: false }));
    }
  };

  const calculateScore = () => {
    let mcqScore = 0;
    (testData?.mcqs || []).forEach((q, i) => {
      if (mcqAnswers[i] === q.answer) mcqScore++;
    });
    const codingScore = Object.values(codeResults).reduce((sum, r) => sum + (r.passed_count || 0), 0);
    const codingTotal = (testData?.coding || []).reduce((sum, q) => sum + (q.test_cases?.length || 0), 0);
    return { mcqScore, mcqTotal: (testData?.mcqs || []).length, codingScore, codingTotal };
  };

  const submitTest = async () => {
    setSubmitting(true);

    const finalCodeResults = { ...codeResults };
    let didUpdate = false;
    for (let i = 0; i < codingQs.length; i++) {
        if (!finalCodeResults[i]) {
            const code = codingAnswers[i] || '';
            const lang = codingLanguages[i] || 'python';
            const cq = codingQs[i];
            if (code.trim()) {
                try {
                    const resp = await fetch(`${apiBase}/test/run-code`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            problem_text: `${cq.title}\n${cq.description}\nConstraints: ${cq.constraints || ''}`,
                            code, language: lang, test_cases: cq.test_cases || [],
                        })
                    });
                    finalCodeResults[i] = await resp.json();
                    didUpdate = true;
                } catch(e) {}
            }
        }
    }
    if (didUpdate) setCodeResults(finalCodeResults);

    let mcqScore = 0;
    (testData?.mcqs || []).forEach((q, i) => { if (mcqAnswers[i] === q.answer) mcqScore++; });
    const codingScore = Object.values(finalCodeResults).reduce((sum, r) => sum + (r.passed_count || 0), 0);
    const codingTotal = (testData?.coding || []).reduce((sum, q) => sum + (q.test_cases?.length || 0), 0);
    const scores = { mcqScore, mcqTotal: (testData?.mcqs || []).length, codingScore, codingTotal };

    const mcqAnswerDetails = (testData?.mcqs || []).map((q, i) => ({
      question: q.question, selected: mcqAnswers[i] || 'Not Answered',
      correct: q.answer, is_correct: mcqAnswers[i] === q.answer,
      explanation: q.explanation || 'No explanation provided.'
    }));
    const codingAnswerDetails = (testData?.coding || []).map((q, i) => ({
      title: q.title, code: codingAnswers[i] || '', language: codingLanguages[i] || 'python',
      results: finalCodeResults[i] || { success: false, feedback: 'Not evaluated', results: [] },
    }));


    try {
      await fetch(`${apiBase}/test/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token, email: verifiedEmail || email,
          mcq_score: scores.mcqScore, mcq_total: scores.mcqTotal,
          coding_score: scores.codingScore, coding_total: scores.codingTotal,
          suspicious: computeViolationStatus(),
          proctoring_summary: {
            tab_switches: tabSwitches,
            fullscreen_exits: fullscreenExits,
            camera_denied: cameraDenied,
            face_missing_events: faceMissingEvents,
            face_out_of_frame_events: faceOutOfFrameEvents,
            multi_face_events: multiFaceEvents,
            long_face_missing_events: longFaceMissingEvents,
            violation_count: violationCount,
            violation_limit: VIOLATION_LIMIT,
            face_direction_counts: faceDirectionCounts,
            face_tracking_supported: faceTrackingSupported,
            event_count: proctoringEvents.length,
          },
          proctoring_events: proctoringEvents,
          mcq_answers: mcqAnswerDetails, coding_answers: codingAnswerDetails,
        })
      });
      setPhase('submitted');
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    } catch (e) {
      alert('Submission error. Please try again.');
    } finally {
      setSubmitting(false);
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
      if (faceCheckIntervalRef.current) {
        clearInterval(faceCheckIntervalRef.current);
        faceCheckIntervalRef.current = null;
      }
      clearInterval(timerRef.current);
    }
  };

  const handleAutoSubmit = (reason = 'time_up') => {
    if (reason === 'violation_limit') {
      alert(`❌ Maximum violations reached (${VIOLATION_LIMIT}/${VIOLATION_LIMIT}). Auto-submitting your test.`);
    } else {
      alert('⏰ Time is up! Auto-submitting.');
    }
    submitTest();
  };
  const handleManualSubmit = () => { if (window.confirm('Submit your test? You cannot change answers after.')) submitTest(); };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0a0d14', color: '#f8fafc' }}>
        <div style={{ textAlign: 'center' }}>
          <Loader size={40} color="#6366f1" style={{ animation: 'spin 1s linear infinite' }} />
          <p style={{ marginTop: '16px', color: '#94a3b8' }}>Loading assessment...</p>
        </div>
      </div>
    );
  }

  if (!token || !testData || !testData.mcqs) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0a0d14', color: '#f8fafc', textAlign: 'center' }}>
        <AlertTriangle size={60} color="#f59e0b" style={{ marginBottom: '20px' }} />
        <h1 style={{ marginBottom: '10px' }}>Invalid Assessment Link</h1>
        <p style={{ color: '#94a3b8' }}>This test link is invalid or has expired. Contact your recruiter.</p>
      </div>
    );
  }

  // ── SUBMITTED ──
  if (phase === 'submitted') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0a0d14', color: '#f8fafc', textAlign: 'center', padding: '40px' }}>
        <div style={{ background: '#111827', borderRadius: '20px', padding: '50px', maxWidth: '500px', border: '1px solid rgba(16,185,129,0.3)' }}>
          <CheckCircle size={80} color="#10b981" style={{ marginBottom: '20px' }} />
          <h1 style={{ color: '#10b981', marginBottom: '12px', fontSize: '1.8rem' }}>Test Submitted!</h1>
          <p style={{ color: '#94a3b8', lineHeight: 1.6, marginBottom: '24px' }}>
            Your answers have been recorded successfully. The hiring team at <strong style={{ color: '#f8fafc' }}>{testData.company_name || 'the company'}</strong> will review your results.
          </p>
          <div style={{ background: '#1e293b', borderRadius: '10px', padding: '16px', textAlign: 'left' }}>
            <p style={{ margin: '0 0 6px', fontSize: '0.85rem', color: '#64748b' }}>📧 Submitted as: <span style={{ color: '#f8fafc' }}>{email}</span></p>
            <p style={{ margin: '0', fontSize: '0.85rem', color: '#64748b' }}>🕐 Submitted at: <span style={{ color: '#f8fafc' }}>{new Date().toLocaleString()}</span></p>
          </div>
          <p style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '20px' }}>You may close this window now.</p>
        </div>
      </div>
    );
  }

  // ── VERIFICATION (Pre-Test Screen) ──
  if (phase === 'verify') {
    const mcqCount = testData.mcqs?.length || 0;
    const codingCount = testData.coding?.length || 0;
    const duration = testData.duration_minutes || 60;

    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0a0d14', color: '#f8fafc', padding: '20px' }}>
        <div style={{ background: '#111827', borderRadius: '20px', padding: '40px', maxWidth: '700px', width: '100%', border: '1px solid rgba(255,255,255,0.06)' }}>
          
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '30px' }}>
            {testData.company_name && (
              <div style={{ background: 'linear-gradient(135deg, #6366f1, #0ea5e9)', padding: '12px 24px', borderRadius: '10px', display: 'inline-block', marginBottom: '16px' }}>
                <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#fff', fontWeight: 700 }}>{testData.company_name}</h2>
              </div>
            )}
            <h1 style={{ margin: '0 0 8px', fontSize: '1.6rem' }}>Technical Assessment</h1>
            <p style={{ margin: 0, color: '#6366f1', fontWeight: 600, fontSize: '1.1rem' }}>{testData.job_title}</p>
          </div>

          {/* Test Structure Table */}
          <div style={{ background: '#1e293b', borderRadius: '12px', overflow: 'hidden', marginBottom: '24px' }}>
            <div style={{ background: '#334155', padding: '12px 20px' }}>
              <h3 style={{ margin: 0, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#94a3b8' }}>Assessment Structure</h3>
            </div>
            <div style={{ padding: '4px 20px' }}>
              <table style={{ width: '100%', fontSize: '0.95rem' }}>
                <tbody>
                  {testData.test_date && testData.test_date !== 'Immediate' && (
                    <tr style={{ borderBottom: '1px solid #334155' }}>
                      <td style={{ padding: '12px 0', color: '#94a3b8' }}>📅 Date</td>
                      <td style={{ padding: '12px 0', fontWeight: 600, textAlign: 'right' }}>{testData.test_date}</td>
                    </tr>
                  )}
                  <tr style={{ borderBottom: '1px solid #334155' }}>
                    <td style={{ padding: '12px 0', color: '#94a3b8' }}>⏱️ Duration</td>
                    <td style={{ padding: '12px 0', fontWeight: 600, textAlign: 'right' }}>{duration} Minutes</td>
                  </tr>
                  {mcqCount > 0 && (
                    <tr style={{ borderBottom: '1px solid #334155' }}>
                      <td style={{ padding: '12px 0', color: '#94a3b8' }}>📝 MCQ Questions</td>
                      <td style={{ padding: '12px 0', fontWeight: 600, textAlign: 'right' }}>{mcqCount}</td>
                    </tr>
                  )}
                  {codingCount > 0 && (
                    <tr style={{ borderBottom: '1px solid #334155' }}>
                      <td style={{ padding: '12px 0', color: '#94a3b8' }}>💻 Coding Challenges</td>
                      <td style={{ padding: '12px 0', fontWeight: 600, textAlign: 'right' }}>{codingCount}</td>
                    </tr>
                  )}
                  <tr>
                    <td style={{ padding: '12px 0', color: '#94a3b8' }}>🖥️ Environment</td>
                    <td style={{ padding: '12px 0', fontWeight: 600, textAlign: 'right' }}>Online Proctored</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Rules */}
          <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
            <h3 style={{ margin: '0 0 14px', color: '#f59e0b', fontSize: '0.95rem' }}>⚠️ Rules & Regulations</h3>
            <ul style={{ margin: 0, paddingLeft: '20px', color: '#fbbf24', fontSize: '0.88rem', lineHeight: 2 }}>
              <li>Your <strong>webcam must remain active</strong> throughout the entire test</li>
              <li>Keep your <strong>face visible and centered</strong> throughout the test</li>
              <li>Missing face or looking away for long duration is automatically flagged</li>
              <li>Multiple faces in frame are treated as a <strong>major violation</strong></li>
              <li>Tab switching will be <strong>detected and flagged</strong> — repeated switches raise violation level</li>
              <li>The test will <strong>auto-submit</strong> when the timer reaches zero</li>
              <li>You <strong>must use a desktop/laptop</strong> — mobiles and tablets are blocked</li>
              <li>No external help, reference materials, or browser extensions</li>
              <li>Do not copy-paste from outside sources</li>
              <li>Ensure a <strong>stable internet connection</strong> before starting</li>
              <li>Once started, you <strong>cannot pause or restart</strong> the test</li>
            </ul>
          </div>

          {/* Email Input */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '8px' }}>Your Email Address</label>
            <input type="email" value={email} onChange={e => { setEmail(e.target.value); setVerifiedEmail(''); }}
              placeholder="Enter the email you applied with"
              style={{ width: '100%', padding: '14px 18px', background: '#1e293b', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', color: '#f8fafc', fontSize: '1rem' }} />
          </div>

          {cameraError && <p style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: '12px' }}>{cameraError}</p>}

          <button onClick={handleStartTest} disabled={starting}
            style={{ width: '100%', padding: '16px', background: 'linear-gradient(135deg, #6366f1, #0ea5e9)', border: 'none', borderRadius: '10px', color: 'white', fontSize: '1.1rem', fontWeight: 700, cursor: 'pointer', letterSpacing: '0.5px' }}>
            <Camera size={20} style={{ verticalAlign: 'middle', marginRight: '10px' }} />
            {starting ? 'Verifying Candidate...' : 'Enable Camera & Start Test'}
          </button>

          <p style={{ textAlign: 'center', color: '#475569', fontSize: '0.75rem', marginTop: '16px' }}>
            By clicking above, you agree to the proctoring terms and grant camera access.
          </p>
        </div>
      </div>
    );
  }

  // ── MAIN TEST UI ──
  const mcqs = testData?.mcqs || [];
  const codingQs = testData?.coding || [];
  const totalAnswered = Object.keys(mcqAnswers).length + Object.keys(codingAnswers).filter(k => codingAnswers[k]?.trim()).length;
  const totalQuestions = mcqs.length + codingQs.length;
  const violationVisualLevel = violationCount >= VIOLATION_LIMIT ? 'danger' : violationCount >= 2 ? 'warn' : violationCount > 0 ? 'mild' : 'none';

  return (
    <div className={`test-environment-container violation-${violationVisualLevel}`} style={{ display: 'flex', minHeight: '100vh', background: '#0a0d14', color: '#f8fafc', position: 'relative' }}>

      {violationVisualLevel !== 'none' && <div className={`test-violation-overlay ${violationVisualLevel}`} />}
      
      {/* Mobile overlay */}
      {sidebarOpen && isMobile && (
        <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9 }} />
      )}
      
      {/* ── SIDEBAR (Responsive) ── */}
      <div className={`test-sidebar ${sidebarOpen ? 'open' : ''}`} style={{
        width: isMobile ? '90vw' : (isMobile ? '100%' : '260px'),
        background: '#111827',
        borderRight: isMobile ? 'none' : '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        flexDirection: 'column',
        position: isMobile ? 'fixed' : 'fixed',
        height: isMobile ? '100vh' : '100vh',
        zIndex: sidebarOpen && isMobile ? 100 : 10,
        transform: isMobile && !sidebarOpen ? 'translateX(-100%)' : 'translateX(0)',
        transition: 'transform 0.3s ease',
        maxWidth: isMobile ? '90vw' : '260px',
        left: 0,
      }}>
        
        {/* Camera */}
        <div style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <video ref={videoRef} autoPlay muted playsInline
            style={{ width: '100%', borderRadius: '8px', background: '#000', aspectRatio: '4/3', objectFit: 'cover' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '0.75rem' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: cameraActive ? '#10b981' : '#ef4444', boxShadow: cameraActive ? '0 0 6px #10b981' : 'none' }}></div>
            <span style={{ color: cameraActive ? '#10b981' : '#ef4444' }}>{cameraActive ? 'Recording' : 'Camera Off'}</span>
          </div>
        </div>

        {/* Timer */}
        <div style={{ padding: '16px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#64748b', letterSpacing: '1.5px', marginBottom: '4px' }}>Time Remaining</div>
          <div style={{
            fontSize: isMobile ? '1.6rem' : '2rem', fontWeight: 800, fontFamily: 'monospace', letterSpacing: '2px',
            color: timeLeft < 300 ? '#ef4444' : timeLeft < 600 ? '#f59e0b' : '#10b981',
            textShadow: timeLeft < 300 ? '0 0 10px rgba(239,68,68,0.5)' : 'none',
          }}>
            {formatTime(timeLeft)}
          </div>
        </div>

        {/* Progress */}
        <div style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b', marginBottom: '6px' }}>
            <span>Progress</span>
            <span>{totalAnswered}/{totalQuestions}</span>
          </div>
          <div style={{ height: '4px', background: '#1e293b', borderRadius: '2px' }}>
            <div style={{ width: `${totalQuestions > 0 ? (totalAnswered / totalQuestions) * 100 : 0}%`, height: '100%', background: 'linear-gradient(90deg, #6366f1, #10b981)', borderRadius: '2px', transition: 'width 0.3s' }}></div>
          </div>

          <div className={`test-violation-banner ${violationCount >= VIOLATION_LIMIT ? 'danger' : violationCount > 0 ? 'warn' : 'safe'}`}>
            Violations: {violationCount}/{VIOLATION_LIMIT}
          </div>
        </div>

        {/* Question Navigator */}
        <div style={{ padding: '12px', flex: 1, overflowY: 'auto' }}>
          <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '8px', textTransform: 'uppercase' }}>Questions</div>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {mcqs.map((_, i) => (
              <button key={`m${i}`} onClick={() => { setCurrentSection('mcq'); setCurrentQ(i); setSidebarOpen(false); }}
                style={{
                  width: '32px', height: '32px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
                  background: currentSection === 'mcq' && currentQ === i ? '#6366f1'
                    : mcqAnswers[i] ? 'rgba(16,185,129,0.2)' : flaggedQuestions[`mcq_${i}`] ? 'rgba(245,158,11,0.2)' : '#1e293b',
                  color: currentSection === 'mcq' && currentQ === i ? '#fff'
                    : mcqAnswers[i] ? '#10b981' : flaggedQuestions[`mcq_${i}`] ? '#f59e0b' : '#64748b',
                }}>
                {i + 1}
              </button>
            ))}
          </div>
          {codingQs.length > 0 && (
            <>
              <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '12px', marginBottom: '8px', textTransform: 'uppercase' }}>Coding</div>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {codingQs.map((_, i) => (
                  <button key={`c${i}`} onClick={() => { setCurrentSection('coding'); setCurrentQ(i); setSidebarOpen(false); }}
                    style={{
                      width: '32px', height: '32px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
                      background: currentSection === 'coding' && currentQ === i ? '#0ea5e9'
                        : codingAnswers[i] ? 'rgba(16,185,129,0.2)' : '#1e293b',
                      color: currentSection === 'coding' && currentQ === i ? '#fff'
                        : codingAnswers[i] ? '#10b981' : '#64748b',
                    }}>
                    C{i + 1}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Warnings */}
        {(tabSwitches > 0 || fullscreenExits > 0 || faceMissingEvents > 0 || faceOutOfFrameEvents > 0 || multiFaceEvents > 0) && (
          <div style={{ padding: '12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: '0.75rem', color: tabSwitches >= 3 ? '#ef4444' : '#f59e0b', fontWeight: 600, marginBottom: '4px' }}>
              <AlertTriangle size={12} style={{ verticalAlign: 'middle' }} /> Tab Switches: {tabSwitches}/3
            </div>
            <div style={{ fontSize: '0.75rem', color: fullscreenExits >= 2 ? '#ef4444' : '#f59e0b', fontWeight: 600, marginBottom: '4px' }}>
              <AlertTriangle size={12} style={{ verticalAlign: 'middle' }} /> Fullscreen Exits: {fullscreenExits}/2
            </div>
            <div style={{ fontSize: '0.75rem', color: faceTrackingSupported ? '#38bdf8' : '#94a3b8', fontWeight: 600, marginBottom: '4px' }}>
              <Camera size={12} style={{ verticalAlign: 'middle' }} /> Face Tracking: {faceTrackingSupported ? faceTrackingState : 'Unsupported in this browser'}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: '4px' }}>
              face-direction: L{faceDirectionCounts.left} R{faceDirectionCounts.right} U{faceDirectionCounts.up} D{faceDirectionCounts.down}
            </div>
            {faceTrackingSupported && (
              <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                face-missing: {faceMissingEvents} | off-frame: {faceOutOfFrameEvents} | multi-face: {multiFaceEvents}
              </div>
            )}
          </div>
        )}

        {/* Submit */}
        <div style={{ padding: '12px' }}>
          <button onClick={handleManualSubmit} disabled={submitting}
            style={{ width: '100%', padding: '12px', background: '#10b981', border: 'none', borderRadius: '8px', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}>
            <Send size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
            {submitting ? 'Submitting...' : 'Submit Test'}
          </button>
        </div>
      </div>

      {/* ── MAIN CONTENT AREA (Responsive) ── */}
      <div className="test-main-content" style={{ 
        marginLeft: isMobile ? 0 : '260px', 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column',
        width: isMobile ? '100%' : 'auto'
      }}>
        
        {/* Mobile Header with Hamburger */}
        {isMobile && (
          <div style={{ background: '#111827', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ background: 'transparent', border: 'none', color: '#f8fafc', cursor: 'pointer', fontSize: '24px', padding: '0' }}>
              ☰
            </button>
            <span style={{ flex: 1, fontSize: '0.9rem', fontWeight: 600, color: '#f8fafc' }}>
              {currentSection === 'mcq' ? 'MCQ' : 'Coding'} - Q{currentQ + 1}
            </span>
          </div>
        )}
        
        {/* Top Tab Bar */}
        <div style={{ background: '#111827', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 12px', display: 'flex', alignItems: 'center', gap: '4px', position: 'sticky', top: 0, zIndex: 5, overflowX: 'auto' }}>
          <button onClick={() => { setCurrentSection('mcq'); setCurrentQ(0); }}
            style={{ padding: isMobile ? '12px 14px' : '14px 20px', background: 'transparent', border: 'none', color: currentSection === 'mcq' ? '#6366f1' : '#64748b', cursor: 'pointer', fontWeight: 600, fontSize: isMobile ? '0.8rem' : '0.9rem', borderBottom: currentSection === 'mcq' ? '2px solid #6366f1' : '2px solid transparent', whiteSpace: 'nowrap' }}>
            <BookOpen size={isMobile ? 14 : 16} style={{ verticalAlign: 'middle', marginRight: '4px' }} />MCQ
          </button>
          {codingQs.length > 0 && (
            <button onClick={() => { setCurrentSection('coding'); setCurrentQ(0); }}
              style={{ padding: isMobile ? '12px 14px' : '14px 20px', background: 'transparent', border: 'none', color: currentSection === 'coding' ? '#0ea5e9' : '#64748b', cursor: 'pointer', fontWeight: 600, fontSize: isMobile ? '0.8rem' : '0.9rem', borderBottom: currentSection === 'coding' ? '2px solid #0ea5e9' : '2px solid transparent', whiteSpace: 'nowrap' }}>
              <Code size={isMobile ? 14 : 16} style={{ verticalAlign: 'middle', marginRight: '4px' }} />Coding
            </button>
          )}
          {!isMobile && (
            <>
              <div style={{ flex: 1 }}></div>
              <span style={{ fontSize: '0.8rem', color: '#64748b', whiteSpace: 'nowrap' }}>{testData.company_name || ''} • {testData.job_title}</span>
            </>
          )}
        </div>

        {/* ── MCQ SECTION ── */}
        {currentSection === 'mcq' && mcqs.length > 0 && (
          <div style={{ padding: isMobile ? '16px' : '30px 40px', flex: 1, overflowY: 'auto' }}>
            <div style={{ maxWidth: '100%', margin: '0 auto' }}>
              {/* Question header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
                <span style={{ fontSize: isMobile ? '0.75rem' : '0.8rem', color: '#64748b', fontWeight: 500 }}>
                  Question {currentQ + 1} of {mcqs.length}
                </span>
                <button onClick={() => toggleFlag(`mcq_${currentQ}`)}
                  style={{ background: flaggedQuestions[`mcq_${currentQ}`] ? 'rgba(245,158,11,0.15)' : 'transparent', border: `1px solid ${flaggedQuestions[`mcq_${currentQ}`] ? '#f59e0b' : 'rgba(255,255,255,0.08)'}`, borderRadius: '6px', padding: isMobile ? '4px 8px' : '6px 12px', cursor: 'pointer', color: flaggedQuestions[`mcq_${currentQ}`] ? '#f59e0b' : '#64748b', fontSize: isMobile ? '0.75rem' : '0.8rem', whiteSpace: 'nowrap' }}>
                  <Flag size={isMobile ? 10 : 12} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                  {flaggedQuestions[`mcq_${currentQ}`] ? 'Flagged' : 'Flag'}
                </button>
              </div>

              {/* Question card */}
              <div style={{ background: '#111827', borderRadius: '14px', padding: isMobile ? '16px' : '32px', border: '1px solid rgba(255,255,255,0.06)', marginBottom: '24px' }}>
                <h2 style={{ fontSize: isMobile ? '1rem' : '1.15rem', fontWeight: 600, lineHeight: 1.6, margin: '0 0 22px', color: '#f1f5f9' }}>
                  {mcqs[currentQ].question}
                </h2>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {mcqs[currentQ].options?.map((opt, oi) => (
                    <button key={oi} onClick={() => handleMcqAnswer(currentQ, opt)}
                      style={{
                        padding: isMobile ? '12px 14px' : '16px 20px', textAlign: 'left', cursor: 'pointer', fontSize: isMobile ? '0.9rem' : '0.95rem',
                        background: mcqAnswers[currentQ] === opt ? 'rgba(99,102,241,0.15)' : '#1e293b',
                        border: `2px solid ${mcqAnswers[currentQ] === opt ? '#6366f1' : 'rgba(255,255,255,0.04)'}`,
                        borderRadius: '10px', color: '#f1f5f9', transition: 'all 0.15s',
                        display: 'flex', alignItems: 'center', gap: '12px',
                      }}>
                      <span style={{
                        display: 'inline-flex', width: isMobile ? '28px' : '32px', height: isMobile ? '28px' : '32px', borderRadius: '50%', alignItems: 'center', justifyContent: 'center', fontSize: isMobile ? '0.8rem' : '0.85rem', fontWeight: 700, flexShrink: 0,
                        background: mcqAnswers[currentQ] === opt ? '#6366f1' : '#334155',
                        color: mcqAnswers[currentQ] === opt ? '#fff' : '#94a3b8',
                      }}>
                        {String.fromCharCode(65 + oi)}
                      </span>
                      <span style={{ overflow: 'wrap', wordBreak: 'break-word' }}>{opt}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Navigation */}
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                <button onClick={() => setCurrentQ(Math.max(0, currentQ - 1))} disabled={currentQ === 0}
                  style={{ padding: isMobile ? '8px 12px' : '10px 20px', background: '#1e293b', border: 'none', borderRadius: '8px', color: currentQ === 0 ? '#334155' : '#94a3b8', cursor: currentQ === 0 ? 'default' : 'pointer', fontSize: isMobile ? '0.8rem' : '0.9rem', minWidth: 'fit-content' }}>
                  <ChevronLeft size={isMobile ? 14 : 16} style={{ verticalAlign: 'middle' }} />
                </button>
                <button onClick={() => {
                  if (currentQ === mcqs.length - 1 && codingQs.length > 0) {
                    setCurrentSection('coding'); setCurrentQ(0);
                  } else if (currentQ === mcqs.length - 1 && codingQs.length === 0) {
                    handleManualSubmit();
                  } else {
                    setCurrentQ(Math.min(mcqs.length - 1, currentQ + 1));
                  }
                }}
                  style={{ padding: isMobile ? '8px 12px' : '10px 20px', background: '#6366f1', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: isMobile ? '0.8rem' : '0.9rem', flex: 1, minWidth: 'fit-content' }}>
                  {currentQ === mcqs.length - 1
                    ? (codingQs.length > 0 ? 'Go to Coding' : 'Submit')
                    : 'Next'}
                  {!(currentQ === mcqs.length - 1 && codingQs.length === 0) && !isMobile && <ChevronRight size={16} style={{ verticalAlign: 'middle', marginLeft: '6px' }} />}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── CODING SECTION (Responsive Split Pane) ── */}
        {currentSection === 'coding' && codingQs.length > 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: isMobile ? 'column' : 'row', overflow: 'hidden' }}>
            
            {/* LEFT: Problem Description */}
            <div style={{ width: isMobile ? '100%' : '45%', overflowY: 'auto', borderRight: !isMobile ? '1px solid rgba(255,255,255,0.06)' : 'none', borderBottom: isMobile ? '1px solid rgba(255,255,255,0.06)' : 'none', padding: isMobile ? '16px' : '24px', height: isMobile ? 'auto' : '100%', maxHeight: isMobile ? undefined : '100%' }}>
              <div style={{ fontSize: isMobile ? '0.7rem' : '0.75rem', color: '#64748b', marginBottom: '8px' }}>Coding Challenge {currentQ + 1} of {codingQs.length}</div>
              <h2 style={{ margin: '0 0 14px', fontSize: isMobile ? '1rem' : '1.2rem', color: '#f1f5f9' }}>{codingQs[currentQ].title}</h2>
              <p style={{ color: '#94a3b8', lineHeight: 1.7, fontSize: isMobile ? '0.85rem' : '0.9rem', whiteSpace: 'pre-wrap' }}>{codingQs[currentQ].description}</p>

              {codingQs[currentQ].constraints && (
                <div style={{ margin: '14px 0', padding: '10px 12px', background: 'rgba(245,158,11,0.08)', borderRadius: '8px', border: '1px solid rgba(245,158,11,0.2)' }}>
                  <strong style={{ color: '#f59e0b', fontSize: isMobile ? '0.75rem' : '0.8rem' }}>Constraints:</strong>
                  <p style={{ margin: '4px 0 0', color: '#fbbf24', fontSize: isMobile ? '0.8rem' : '0.85rem' }}>{codingQs[currentQ].constraints}</p>
                </div>
              )}

              {/* Example */}
              {codingQs[currentQ].example_input && (
                <div style={{ margin: '14px 0' }}>
                  <h4 style={{ color: '#94a3b8', fontSize: isMobile ? '0.75rem' : '0.8rem', marginBottom: '8px' }}>Example:</h4>
                  <div style={{ background: '#1e293b', borderRadius: '8px', padding: '10px', fontFamily: 'monospace', fontSize: isMobile ? '0.8rem' : '0.85rem' }}>
                    <div style={{ color: '#64748b', marginBottom: '4px' }}>Input:</div>
                    <div style={{ color: '#10b981', marginBottom: '8px', wordBreak: 'break-word' }}>{codingQs[currentQ].example_input}</div>
                    <div style={{ color: '#64748b', marginBottom: '4px' }}>Output:</div>
                    <div style={{ color: '#10b981', wordBreak: 'break-word' }}>{codingQs[currentQ].example_output}</div>
                  </div>
                </div>
              )}

              {/* Test Case Results */}
              {codeResults[currentQ] && (
                <div style={{ marginTop: '18px' }}>
                  <h4 style={{
                    color: codeResults[currentQ].success ? '#10b981' : '#ef4444',
                    fontSize: isMobile ? '0.8rem' : '0.85rem', marginBottom: '10px'
                  }}>
                    Results: {codeResults[currentQ].passed_count}/{codeResults[currentQ].total_count} Passed
                  </h4>
                  {(codeResults[currentQ].results || []).map((r, ri) => (
                    <div key={ri} style={{
                      padding: '8px 10px', margin: '6px 0', borderRadius: '6px', fontSize: isMobile ? '0.75rem' : '0.8rem',
                      background: r.passed ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                      border: `1px solid ${r.passed ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
                      fontFamily: 'monospace',
                    }}>
                      <div style={{ color: r.passed ? '#10b981' : '#ef4444', fontWeight: 600, marginBottom: '4px' }}>
                        {r.passed ? '✓' : '✗'} Test Case {r.test_case || ri + 1}
                      </div>
                      {!r.passed && r.expected && (
                        <div style={{ color: '#94a3b8', fontSize: isMobile ? '0.7rem' : '0.75rem' }}>
                          Expected: {r.expected} | Got: {r.actual || 'N/A'}
                        </div>
                      )}
                    </div>
                  ))}

                  {codeResults[currentQ].feedback && (
                    <p style={{ fontSize: isMobile ? '0.75rem' : '0.8rem', color: '#94a3b8', marginTop: '10px', fontStyle: 'italic' }}>
                      💡 {codeResults[currentQ].feedback}
                    </p>
                  )}
                </div>
              )}

              {/* Coding nav */}
              {isMobile && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '18px', gap: '10px' }}>
                  <button onClick={() => { if (currentQ === 0) { setCurrentSection('mcq'); setCurrentQ(mcqs.length - 1); } else setCurrentQ(currentQ - 1); }}
                    style={{ padding: '8px 12px', background: '#1e293b', border: 'none', borderRadius: '6px', color: '#94a3b8', cursor: 'pointer', fontSize: '0.8rem', flex: 1 }}>
                    ← {currentQ === 0 ? 'Back' : 'Prev'}
                  </button>
                  {currentQ < codingQs.length - 1 && (
                    <button onClick={() => setCurrentQ(currentQ + 1)}
                      style={{ padding: '8px 12px', background: '#0ea5e9', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem', flex: 1 }}>
                      Next →
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* RIGHT: Code Editor */}
            <div style={{ width: isMobile ? '100%' : '55%', display: 'flex', flexDirection: 'column', height: isMobile ? '400px' : '100%' }}>
              {/* Language selector + Run */}
              <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '6px' : '10px', padding: '8px 12px', background: '#111827', borderBottom: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap' }}>
                <select value={codingLanguages[currentQ] || 'python'}
                  onChange={e => handleLanguageChange(currentQ, e.target.value)}
                  style={{ padding: '4px 8px', background: '#1e293b', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', color: '#f8fafc', fontSize: isMobile ? '0.8rem' : '0.85rem' }}>
                  <option value="python">Python</option>
                  <option value="javascript">JavaScript</option>
                  <option value="java">Java</option>
                  <option value="cpp">C++</option>
                </select>
                <button onClick={() => handleRunCode(currentQ)} disabled={runningCode[currentQ]}
                  style={{ padding: isMobile ? '4px 10px' : '6px 16px', background: '#10b981', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: isMobile ? '0.8rem' : '0.85rem', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                  {runningCode[currentQ] ? <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Play size={12} />}
                  {runningCode[currentQ] ? 'Running...' : 'Run'}
                </button>
                {!isMobile && (
                  <>
                    <div style={{ flex: 1 }}></div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      <Terminal size={12} style={{ verticalAlign: 'middle' }} /> Code Editor
                    </span>
                  </>
                )}
              </div>

              {/* Code textarea */}
              <textarea
                value={codingAnswers[currentQ] || ''}
                onChange={e => handleCodingAnswer(currentQ, e.target.value)}
                placeholder={`# Write your ${codingLanguages[currentQ] || 'python'} solution here...\n\ndef solve():\n    pass`}
                spellCheck={false}
                style={{
                  flex: 1, width: '100%', padding: isMobile ? '12px' : '20px', resize: 'none',
                  background: '#0d1117', border: 'none', color: '#c9d1d9',
                  fontSize: isMobile ? '12px' : '14px', fontFamily: "'Fira Code', 'Cascadia Code', 'Consolas', monospace",
                  lineHeight: 1.6, outline: 'none', tabSize: 4,
                }}
                onKeyDown={e => {
                  if (e.key === 'Tab') {
                    e.preventDefault();
                    const start = e.target.selectionStart;
                    const end = e.target.selectionEnd;
                    const value = e.target.value;
                    handleCodingAnswer(currentQ, value.substring(0, start) + '    ' + value.substring(end));
                    setTimeout(() => { e.target.selectionStart = e.target.selectionEnd = start + 4; }, 0);
                  }
                }}
              />

              {!isMobile && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <button onClick={() => { if (currentQ === 0) { setCurrentSection('mcq'); setCurrentQ(mcqs.length - 1); } else setCurrentQ(currentQ - 1); }}
                    style={{ padding: '6px 12px', background: '#1e293b', border: 'none', borderRadius: '6px', color: '#94a3b8', cursor: 'pointer', fontSize: '0.8rem' }}>
                    ← {currentQ === 0 ? 'Back to MCQ' : 'Previous'}
                  </button>
                  {currentQ < codingQs.length - 1 && (
                    <button onClick={() => setCurrentQ(currentQ + 1)}
                      style={{ padding: '6px 12px', background: '#0ea5e9', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}>
                      Next →
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TestEnvironment;
