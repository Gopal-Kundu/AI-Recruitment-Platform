import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import axios from 'axios';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import Footer from './Footer';
import { USER_API_END_POINT } from '@/utils/address';
import { setUser } from '@/redux/authSlice';
import { toast } from 'sonner';
import Skeleton from '@mui/material/Skeleton';
import ReactMarkdown from 'react-markdown';
import AtsResumePreview from './AtsResumePreview';

const JdResumeDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useSelector((store) => store.auth.user);
  const dispatch = useDispatch();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [showJd, setShowJd] = useState(false);
  const [showWeakSpots, setShowWeakSpots] = useState(true);
  const [showCourses, setShowCourses] = useState(true);
  const [showResumePreview, setShowResumePreview] = useState(true);
  const [baseFontSize, setBaseFontSize] = useState(8.5);
  const [baseFontFamily, setBaseFontFamily] = useState('Lora');

  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [editedJson, setEditedJson] = useState('');
  const [saveJsonLoading, setSaveJsonLoading] = useState(false);
  const [optimizeJsonLoading, setOptimizeJsonLoading] = useState(false);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        toast.error('Please select a PDF file. Only PDF format is supported.');
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUploadResume = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      toast.error('Please select a resume file first.');
      return;
    }

    try {
      setUploadLoading(true);
      const form = new FormData();
      form.append("resume", selectedFile);

      const res = await axios.post(
        `${USER_API_END_POINT}/resume/upload`,
        form,
        {
          headers: { "Content-Type": "multipart/form-data" },
          withCredentials: true,
        }
      );

      if (res.data.success) {
        dispatch(setUser(res.data.user));
        toast.success("Resume uploaded successfully!");
        setSelectedFile(null);
      } else {
        toast.error(res.data.message || "Failed to upload resume.");
      }
    } catch (error) {
      console.error(error);
      toast.error("Something went wrong. Please try again later.");
    } finally {
      setUploadLoading(false);
    }
  };
  const fetchDetail = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${USER_API_END_POINT}/jd-resume/${id}`, {
        withCredentials: true,
      });
      if (res.data.success) {
        setData(res.data.data);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load details.');
    } finally {
      setLoading(false);
    }
  };

  const downloadPreviewAsPdf = async () => {
    if (!data?.AtsResumeJson) {
      toast.error('No resume data to download.');
      return;
    }
    try {
      setPdfLoading(true);
      toast.info('Generating PDF via server...', { duration: 5000 });

      const fileName = data?.companyName
        ? `${user?.fullname || 'My'}_Resume_${data.companyName}.pdf`
        : 'Tailored_Resume.pdf';

      const res = await axios.post(
        `${USER_API_END_POINT}/jd-resume/${id}/pdf`,
        { baseFontSize, baseFontFamily },
        { withCredentials: true, responseType: 'blob' }
      );

      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success('PDF downloaded successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to generate PDF. Please try again.');
    } finally {
      setPdfLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchDetail();
    }
  }, [id]);

  const handleShowAtsScore = async () => {
    // 1. Check if user has existing resume or not
    if (!user || !user.profile?.resume) {
      toast.error('Please upload your resume first.');
      navigate('/resumepage');
      return;
    }

    try {
      setActionLoading(true);
      toast.info('Extracting PDF text and analyzing ATS score with Gemini...', { duration: 4000 });

      const res = await axios.post(
        `${USER_API_END_POINT}/jd-resume/${id}/analyze`,
        {},
        { withCredentials: true }
      );

      if (res.data.success) {
        setData(res.data.data);
        toast.success('ATS score and feedback calculated successfully!');
      }
    } catch (err) {
      console.error(err);
      if (err.response?.data?.message === 'NO_RESUME') {
        toast.error('Please upload your resume first.');
        navigate('/resumepage');
      } else {
        toast.error('Failed to analyze resume. Please try again.');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateAtsResume = async () => {
    // 1. Check if user has existing resume or not
    if (!user || !user.profile?.resume) {
      toast.error('Please upload your resume first.');
      navigate('/resumepage');
      return;
    }

    try {
      setActionLoading(true);
      toast.info('Generating tailored resume data. This may take 10-15 seconds...', { duration: 8000 });

      const res = await axios.post(
        `${USER_API_END_POINT}/jd-resume/${id}/generate`,
        {},
        { withCredentials: true }
      );

      if (res.data.success) {
        setData(res.data.data);
        setShowResumePreview(true);
        toast.success('ATS tailored resume generated successfully!');
      }
    } catch (err) {
      console.error(err);
      if (err.response?.data?.message === 'NO_RESUME') {
        toast.error('Please upload your resume first.');
        navigate('/resumepage');
      } else {
        toast.error('Failed to generate ATS resume. Please try again.');
      }
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    if (data?.AtsResumeJson) {
      setEditedJson(data.AtsResumeJson);
    }
  }, [data]);

  const handleModifyExistingResume = async () => {
    try {
      JSON.parse(editedJson);
    } catch (e) {
      toast.error('Invalid JSON format. Please correct it before saving.');
      return;
    }

    try {
      setSaveJsonLoading(true);
      const res = await axios.put(
        `${USER_API_END_POINT}/jd-resume/${id}/update-json`,
        { AtsResumeJson: editedJson },
        { withCredentials: true }
      );

      if (res.data.success) {
        setData(res.data.data);
        toast.success('Resume JSON updated successfully!');
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to update resume JSON.');
    } finally {
      setSaveJsonLoading(false);
    }
  };

  const handleOptimizeAtsFriendlyResume = async () => {
    try {
      JSON.parse(editedJson);
    } catch (e) {
      toast.error('Invalid JSON format. Please correct it before optimizing.');
      return;
    }

    try {
      setOptimizeJsonLoading(true);
      toast.info('Gemini is optimizing your modified resume JSON...', { duration: 6000 });
      const res = await axios.post(
        `${USER_API_END_POINT}/jd-resume/${id}/optimize-json`,
        { AtsResumeJson: editedJson },
        { withCredentials: true }
      );

      if (res.data.success) {
        setData(res.data.data);
        toast.success('Resume JSON optimized for ATS by Gemini!');
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to optimize resume JSON.');
    } finally {
      setOptimizeJsonLoading(false);
    }
  };

  return (
    <>
      <div className="h-full relative flex items-center">
        <Sidebar highlightIndex={6} />
        <Navbar />
      </div>

      <div className="min-h-screen bg-gray-50 text-gray-900 font-sans p-6 md:p-10 flex flex-col items-center pb-24">
        {loading ? (
          <div className="max-w-4xl w-full space-y-6">
            <Skeleton variant="text" width="60%" height={40} />
            <Skeleton variant="text" width="30%" height={24} />
            <Skeleton variant="rectangular" width="100%" height={200} className="rounded-2xl" />
          </div>
        ) : !data ? (
          <div className="max-w-4xl w-full text-center py-20 bg-white border rounded-2xl">
            <h2 className="text-xl font-bold text-red-500">Job Description wise Resume Entry not found.</h2>
            <button onClick={() => navigate('/interviewPrep/jd-resume')} className="mt-4 bg-purple-600 text-white px-4 py-2 rounded-lg">
              Back to List
            </button>
          </div>
        ) : (
          <div className="max-w-4xl w-full space-y-6">
            {/* Header Card */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-purple-600 bg-purple-50 px-2.5 py-0.5 rounded-full">
                    JD Wise Resume
                  </span>
                  {data.resumeLink && (
                    <span className="text-sm font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full">
                      ATS Resume Generated
                    </span>
                  )}
                </div>
                <h1 className="text-3xl font-extrabold text-gray-800 mt-2">{data.companyName}</h1>
                <p className="text-gray-500 text-xs mt-1">
                  Created on {new Date(data.createdAt).toLocaleDateString()}
                </p>
              </div>

              <button
                onClick={() => navigate('/interviewPrep/jd-resume')}
                className="cursor-pointer border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold px-4 py-2 rounded-lg transition text-sm flex items-center justify-center gap-1.5 self-start md:self-auto"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                All Folders
              </button>
            </div>

            {/* Job Description Card */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
              <button
                onClick={() => setShowJd(!showJd)}
                className="w-full flex items-center justify-between text-left font-bold text-gray-800 focus:outline-none"
              >
                <span>Job Description Details</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className={`h-5 w-5 transition-transform duration-200 ${showJd ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              <div
                className={`grid transition-all duration-300 ease-in-out ${showJd ? 'grid-rows-[1fr] opacity-100 mt-4' : 'grid-rows-[0fr] opacity-0 mt-0'}`}
              >
                <div className="overflow-hidden">
                  <div className="pt-4 border-t border-gray-100 text-sm text-gray-600 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto bg-gray-50 p-4 rounded-xl">
                    {data.jobDescription}
                  </div>
                </div>
              </div>
            </div>

            {/* Main Action Banner or Resume Upload Option */}
            {!user?.profile?.resume ? (
              <div className="bg-white border border-purple-100 rounded-2xl p-8 shadow-sm text-center flex flex-col items-center justify-center">
                <div className="w-16 h-16 bg-purple-50 rounded-full flex items-center justify-center mb-4 text-purple-600">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-800">Upload Your Resume</h2>
                <p className="text-gray-500 text-sm mt-1 mb-6 max-w-md">
                  Please upload your resume in <span className="font-semibold text-purple-600">PDF format</span>. Once uploaded, you can generate an ATS-friendly resume or analyze your match score for this job description.
                </p>
                <form onSubmit={handleUploadResume} className="w-full max-w-md space-y-4">
                  <div className="w-full">
                    <input
                      type="file"
                      id="resume-upload"
                      accept="application/pdf"
                      onChange={handleFileChange}
                      disabled={uploadLoading}
                      className="hidden"
                    />
                    <label
                      htmlFor={uploadLoading ? undefined : "resume-upload"}
                      className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-purple-300 rounded-xl cursor-pointer hover:bg-purple-50/50 transition ${uploadLoading ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
                    >
                      {selectedFile ? (
                        <div className="flex flex-col items-center px-4">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-emerald-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-sm font-semibold text-gray-800 text-center truncate max-w-xs">
                            {selectedFile.name}
                          </span>
                          <span className="text-xs text-gray-400 mt-0.5">
                            {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center">
                          <span className="text-purple-600 font-semibold hover:underline">
                            Click to select resume file
                          </span>
                          <span className="text-xs text-gray-400 mt-1">
                            Only PDF files are supported
                          </span>
                        </div>
                      )}
                    </label>
                  </div>
                  {selectedFile && (
                    <div className="flex items-center justify-center gap-3">
                      <button
                        type="submit"
                        disabled={uploadLoading}
                        className="px-5 py-2.5 rounded-xl bg-purple-600 text-white font-medium hover:bg-purple-700 active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm cursor-pointer"
                      >
                        {uploadLoading ? "Uploading..." : "Upload Resume"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedFile(null)}
                        disabled={uploadLoading}
                        className="px-5 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </form>
              </div>
            ) : actionLoading ? (
              <div className="bg-white border border-purple-200 rounded-2xl p-10 shadow-sm text-center flex flex-col items-center justify-center space-y-4">
                <div className="relative flex items-center justify-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-200 border-t-purple-600"></div>
                </div>
                <h3 className="text-lg font-bold text-purple-700">AI Engine is processing</h3>
                <p className="text-gray-500 text-sm max-w-sm">
                  Connecting to Gemini API, parsing pdf, optimizing keywords, and formatting output. Please wait...
                </p>
              </div>
            ) : (!data.initialATSScore && !data.AtsResumeJson) ? (
              <div className="bg-gradient-to-r from-purple-500 to-indigo-600 rounded-2xl p-8 text-white shadow-md text-center flex flex-col items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-purple-200 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <h2 className="text-2xl font-bold">Build or Analyze ATS Resume</h2>
                <p className="text-purple-100 mt-2 max-w-md text-sm leading-relaxed">
                  Analyze your current profile resume matching this Job Description, or create a completely tailored, professional ATS-optimized resume.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 mt-6 w-full max-w-md justify-center">
                  <button
                    onClick={handleShowAtsScore}
                    className="cursor-pointer bg-white text-purple-700 font-bold px-5 py-3 rounded-xl hover:bg-purple-50 transition shadow w-full"
                  >
                    Show ATS Score of Resume
                  </button>
                  <button
                    onClick={handleCreateAtsResume}
                    className="cursor-pointer bg-purple-900 text-white border border-purple-800 font-bold px-5 py-3 rounded-xl hover:bg-purple-950 transition shadow w-full"
                  >
                    Create ATS Resume
                  </button>
                </div>
              </div>
            ) : (
              /* ATS Results Layout */
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  {/* Current/Initial Resume Score Card */}
                  <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm flex flex-col items-center justify-center text-center">
                    <span className="text-gray-500 font-bold text-xs tracking-wider uppercase mb-3">CURRENT RESUME SCORE</span>
                    {data.initialATSScore > 0 ? (
                      <div className="relative flex items-center justify-center mb-2">
                        <svg className="w-24 h-24 transform -rotate-90">
                          <circle
                            cx="48"
                            cy="48"
                            r="40"
                            className="text-gray-100"
                            strokeWidth="6"
                            fill="transparent"
                            stroke="currentColor"
                          />
                          <circle
                            cx="48"
                            cy="48"
                            r="40"
                            className="text-purple-500 transition-all duration-1000"
                            strokeWidth="6"
                            fill="transparent"
                            strokeDasharray={251.2}
                            strokeDashoffset={251.2 - (251.2 * data.initialATSScore) / 100}
                            strokeLinecap="round"
                            stroke="currentColor"
                          />
                        </svg>
                        <span className="absolute text-xl font-bold text-gray-800">{data.initialATSScore}%</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center mb-2 py-4">
                        <span className="text-xs text-gray-400 font-medium mb-2">Not Evaluated</span>
                        <button
                          onClick={handleShowAtsScore}
                          className="text-[10px] bg-purple-50 hover:bg-purple-100 text-purple-600 font-semibold px-2.5 py-1 rounded transition"
                        >
                          Run Score
                        </button>
                      </div>
                    )}
                    <span className="text-[10px] text-gray-400 font-medium">Your current profile resume match</span>
                  </div>

                  {/* Tailored Resume Score Card */}
                  <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm flex flex-col items-center justify-center text-center">
                    <span className="text-gray-500 font-bold text-xs tracking-wider uppercase mb-3">TAILORED RESUME SCORE</span>
                    {data.ATSScoreOfResume > 0 ? (
                      <div className="relative flex items-center justify-center mb-2">
                        <svg className="w-24 h-24 transform -rotate-90">
                          <circle
                            cx="48"
                            cy="48"
                            r="40"
                            className="text-gray-100"
                            strokeWidth="6"
                            fill="transparent"
                            stroke="currentColor"
                          />
                          <circle
                            cx="48"
                            cy="48"
                            r="40"
                            className="text-emerald-500 transition-all duration-1000"
                            strokeWidth="6"
                            fill="transparent"
                            strokeDasharray={251.2}
                            strokeDashoffset={251.2 - (251.2 * data.ATSScoreOfResume) / 100}
                            strokeLinecap="round"
                            stroke="currentColor"
                          />
                        </svg>
                        <span className="absolute text-xl font-bold text-gray-800">{data.ATSScoreOfResume}%</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center mb-2 py-4">
                        <span className="text-xs text-gray-400 font-medium mb-2">Not Generated</span>
                        <button
                          onClick={handleCreateAtsResume}
                          className="text-[10px] bg-emerald-50 hover:bg-emerald-100 text-emerald-600 font-semibold px-2.5 py-1 rounded transition"
                        >
                          Create Now
                        </button>
                      </div>
                    )}
                    <span className="text-[10px] text-gray-400 font-medium">Tailored ATS-optimized resume match</span>
                  </div>

                  {/* Actions & Link Card */}
                  <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm md:col-span-2 flex flex-col justify-between">
                    <div>
                      <h3 className="font-bold text-gray-800 text-base">ATS Tailored Resume Dashboard</h3>
                      <p className="text-gray-500 text-xs mt-1 leading-relaxed">
                        {data.AtsResumeJson
                          ? "Your tailored resume data has been generated. Use the preview to save as PDF."
                          : "Generate an ATS tailored resume based on the job description by clicking Create ATS Resume."}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2.5 mt-4">
                      <button
                        onClick={handleCreateAtsResume}
                        className="cursor-pointer bg-white border border-purple-600 text-purple-600 hover:bg-purple-50 font-semibold px-3.5 py-2 rounded-xl transition text-xs flex items-center gap-1.5"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                        </svg>
                        {data.AtsResumeJson ? "Recreate ATS Resume" : "Create ATS Resume"}
                      </button>

                      <button
                        onClick={handleShowAtsScore}
                        className="cursor-pointer bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold px-3.5 py-2 rounded-xl transition text-xs"
                      >
                        Re-calculate current resume ATS score
                      </button>
                    </div>
                  </div>
                </div>

                {/* Feedback and Weakspots (Full Width Top) */}
                <div className="w-full">
                  <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm flex flex-col">
                    <button
                      onClick={() => setShowWeakSpots(!showWeakSpots)}
                      className="w-full flex items-center justify-between text-left focus:outline-none"
                    >
                      <div className="flex items-center gap-2 text-rose-600 font-bold">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <span>Weak Spots In Resume</span>
                      </div>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${showWeakSpots ? 'rotate-180' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    <div
                      className={`grid transition-all duration-300 ease-in-out ${showWeakSpots ? 'grid-rows-[1fr] opacity-100 mt-4' : 'grid-rows-[0fr] opacity-0 mt-0'}`}
                    >
                      <div className="overflow-hidden">
                        <div className="text-gray-600 text-sm leading-relaxed flex-1 pt-4 border-t border-gray-100">
                          <ReactMarkdown
                            components={{
                              h3: ({ node, ...props }) => <h3 className="text-md font-bold text-gray-800 mt-4 mb-2" {...props} />,
                              ul: ({ node, ...props }) => <ul className="list-disc pl-5 mb-4 space-y-1.5" {...props} />,
                              ol: ({ node, ...props }) => <ol className="list-decimal pl-5 mb-4 space-y-1.5" {...props} />,
                              li: ({ node, ...props }) => <li className="text-gray-600" {...props} />,
                              strong: ({ node, ...props }) => <strong className="font-semibold text-gray-800" {...props} />,
                              p: ({ node, ...props }) => <p className="mb-2" {...props} />,
                            }}
                          >
                            {data.WeakSpotInResume || "No major weak spots found!"}
                          </ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* YouTube Searches & Courses */}
                <div className="w-full">
                  <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm flex flex-col">
                    <button
                      onClick={() => setShowCourses(!showCourses)}
                      className="w-full flex items-center justify-between text-left focus:outline-none"
                    >
                      <div className="flex items-center gap-2 text-purple-600 font-bold">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                        <span>Recommended Searches & Courses</span>
                      </div>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${showCourses ? 'rotate-180' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    <div
                      className={`grid transition-all duration-300 ease-in-out ${showCourses ? 'grid-rows-[1fr] opacity-100 mt-4' : 'grid-rows-[0fr] opacity-0 mt-0'}`}
                    >
                      <div className="overflow-hidden">
                        <div className="text-gray-600 text-sm leading-relaxed flex-1 pt-4 border-t border-purple-100">
                          <ReactMarkdown
                            components={{
                              h3: ({ node, ...props }) => <h3 className="text-md font-bold text-purple-700 mt-4 mb-2 border-b border-purple-100 pb-1" {...props} />,
                              ul: ({ node, ...props }) => <ul className="list-disc pl-5 mb-4 space-y-2 marker:text-purple-500" {...props} />,
                              ol: ({ node, ...props }) => <ol className="list-decimal pl-5 mb-4 space-y-2 marker:text-purple-600 marker:font-semibold" {...props} />,
                              li: ({ node, ...props }) => <li className="text-gray-700 leading-relaxed" {...props} />,
                              strong: ({ node, ...props }) => <strong className="font-bold text-gray-900" {...props} />,
                              p: ({ node, ...props }) => <p className="mb-2" {...props} />,
                              em: ({ node, ...props }) => <em className="text-gray-500 not-italic block mt-0.5 text-xs" {...props} />
                            }}
                          >
                            {data.recomendedYoutubeSearchesAndCourses || "No specific learning paths recommended."}
                          </ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Rendered Resume Preview */}
                {data.AtsResumeJson && (() => {
                  let resumeData = null;
                  try { resumeData = JSON.parse(data.AtsResumeJson); } catch (e) { }
                  if (!resumeData) return null;
                  return (
                    <>
                      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                        <div className="w-full flex items-center justify-between">
                          <button
                            onClick={() => setShowResumePreview(!showResumePreview)}
                            className="flex items-center gap-2 text-left font-bold text-gray-800 focus:outline-none"
                          >
                            <span>New Resume</span>
                          </button>
                          {data.AtsResumeJson && (
                            <div className="flex items-center gap-3 flex-wrap">
                              {/* Dynamic Font Family Selection */}
                              <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 px-2 py-1 rounded-lg text-[10px] sm:text-xs">
                                <span className="text-gray-500 font-medium select-none">Font:</span>
                                <select
                                  value={baseFontFamily}
                                  onChange={(e) => setBaseFontFamily(e.target.value)}
                                  className="bg-white border border-gray-200 rounded px-1.5 py-0.5 text-gray-700 font-semibold focus:outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer text-[10px] sm:text-xs"
                                >
                                  <option value="Lora">Lora</option>
                                  <option value="Inter">Inter</option>
                                  <option value="Roboto">Roboto</option>
                                  <option value="Merriweather">Merriweather</option>
                                  <option value="Open Sans">Open Sans</option>
                                  <option value="EB Garamond">EB Garamond</option>
                                  <option value="Montserrat">Montserrat</option>
                                  <option value="Poppins">Poppins</option>
                                  <option value="Lato">Lato</option>
                                  <option value="Ubuntu">Ubuntu</option>
                                  <option value="Nunito">Nunito</option>
                                  <option value="Raleway">Raleway</option>
                                  <option value="PT Sans">PT Sans</option>
                                  <option value="PT Serif">PT Serif</option>
                                  <option value="Playfair Display">Playfair Display</option>
                                  <option value="Fira Sans">Fira Sans</option>
                                  <option value="Oswald">Oswald</option>
                                </select>
                              </div>

                              {/* Dynamic Font Size Control Panel */}
                              <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 px-2 py-1 rounded-lg text-[10px] sm:text-xs">
                                <span className="text-gray-500 font-medium select-none">Font Size:</span>
                                <button
                                  onClick={() => setBaseFontSize(prev => Math.max(7.0, +(prev - 0.5).toFixed(1)))}
                                  className="w-5 h-5 flex items-center justify-center bg-white border border-gray-200 rounded font-bold text-gray-600 hover:bg-gray-100 hover:text-gray-900 active:scale-90 transition select-none cursor-pointer"
                                  title="Decrease font size"
                                >
                                  -
                                </button>
                                <span className="font-bold text-gray-800 w-9 text-center select-none">{baseFontSize}pt</span>
                                <button
                                  onClick={() => setBaseFontSize(prev => Math.min(12.0, +(prev + 0.5).toFixed(1)))}
                                  className="w-5 h-5 flex items-center justify-center bg-white border border-gray-200 rounded font-bold text-gray-600 hover:bg-gray-100 hover:text-gray-900 active:scale-90 transition select-none cursor-pointer"
                                  title="Increase font size"
                                >
                                  +
                                </button>
                              </div>

                              <button
                                onClick={() => downloadPreviewAsPdf()}
                                disabled={pdfLoading}
                                className="bg-purple-600 hover:bg-purple-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold px-3 py-1.5 rounded-lg transition text-xs flex items-center gap-1.5 shadow cursor-pointer"
                              >
                                {pdfLoading ? (
                                  <>
                                    <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                    </svg>
                                    Generating...
                                  </>
                                ) : (
                                  <>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                    Download PDF
                                  </>
                                )}
                              </button>
                            </div>
                          )}
                        </div>

                        <div
                          className={`grid transition-all duration-300 ease-in-out ${showResumePreview ? 'grid-rows-[1fr] opacity-100 mt-4' : 'grid-rows-[0fr] opacity-0 mt-0'}`}
                        >
                          <div className="overflow-hidden">
                            <div className="pt-4 border-t border-gray-100 overflow-x-auto">
                              <AtsResumePreview resumeData={resumeData} baseFontSize={baseFontSize} baseFontFamily={baseFontFamily} />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Edit JSON Section */}
                      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm flex flex-col space-y-4">
                        <div className="flex items-center gap-2 text-purple-600 font-bold">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          <span>Modify ATS Resume JSON Data</span>
                        </div>
                        <p className="text-gray-500 text-xs leading-relaxed">
                          Directly edit the structured resume fields below. Click <strong>MODIFY EXISTING RESUME</strong> to save your manual edits, or click <strong>MODIFY TO ATS FRIENDLY RESUME BY GEMINI AI</strong> to have Gemini analyze and optimize your updates.
                        </p>
                        <div className="relative">
                          <textarea
                            value={editedJson}
                            onChange={(e) => setEditedJson(e.target.value)}
                            className="w-full h-96 font-mono text-xs p-4 bg-slate-950 text-emerald-400 rounded-xl border border-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent leading-relaxed resize-y"
                            spellCheck="false"
                          />
                        </div>
                        <div className="flex flex-wrap gap-3 pt-2">
                          <button
                            onClick={handleModifyExistingResume}
                            disabled={saveJsonLoading || optimizeJsonLoading}
                            className="cursor-pointer bg-purple-600 hover:bg-purple-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold px-4 py-2.5 rounded-xl transition text-xs flex items-center gap-2 shadow"
                          >
                            {saveJsonLoading ? (
                              <>
                                <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent animate-spin mr-1"></div>
                                Saving...
                              </>
                            ) : (
                              "MODIFY EXISTING RESUME"
                            )}
                          </button>
                          <button
                            onClick={handleOptimizeAtsFriendlyResume}
                            disabled={saveJsonLoading || optimizeJsonLoading}
                            className="cursor-pointer bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold px-4 py-2.5 rounded-xl transition text-xs flex items-center gap-2 shadow"
                          >
                            {optimizeJsonLoading ? (
                              <>
                                <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent animate-spin mr-1"></div>
                                Optimizing with Gemini...
                              </>
                            ) : (
                              "MODIFY TO ATS FRIENDLY RESUME BY GEMINI AI"
                            )}
                          </button>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        )}
      </div>
      <Footer />
    </>
  );
};

export default JdResumeDetail;
