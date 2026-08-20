import Footer from "./Footer";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import JobCard from "./Jobcard";
import { useState, useEffect } from "react";
import axios from "axios";
import { JOB_API_END_POINT } from "@/utils/address";
import { useLocation, useNavigate } from "react-router-dom";
import Pagination from "@mui/material/Pagination";
import Stack from "@mui/material/Stack";
import Skeleton from "@mui/material/Skeleton";

export default function SearchJob() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const initialQuery = params.get("query") || location.state?.query || "";

  const [searchValue, setSearchValue] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [jobs, setJobs] = useState([]);
  const [totalJobs, setTotalJobs] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [error, setError] = useState("");

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      const trimmed = searchValue.trim();
      setDebouncedQuery(trimmed);
      setPage(1);
      if (trimmed) {
        navigate(`/search?query=${encodeURIComponent(trimmed)}`, { replace: true });
      }
    }
  };

  const handleSearchClick = () => {
    const trimmed = searchValue.trim();
    setDebouncedQuery(trimmed);
    setPage(1);
    if (trimmed) {
      navigate(`/search?query=${encodeURIComponent(trimmed)}`, { replace: true });
    }
  };

 
  useEffect(() => {
    const q = new URLSearchParams(location.search).get("query") || location.state?.query || "";
    setSearchValue(q);
    setDebouncedQuery(q);
    setPage(1);
  }, [location.search, location.state]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = searchValue.trim();
      if (trimmed !== debouncedQuery) {
        setDebouncedQuery(trimmed);
        setPage(1);
        if (trimmed) {
          navigate(`/search?query=${encodeURIComponent(trimmed)}`, { replace: true });
        }
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchValue]);


  useEffect(() => {
    let isMounted = true;

    async function fetchJobs() {
      if (!debouncedQuery) {
        if (isMounted) {
          setJobs([]);
          setTotalJobs(0);
          setLoading(false);
          setIsInitialLoad(false);
        }
        return;
      }

      try {
        setLoading(true);

        const res = await axios.get(
          `${JOB_API_END_POINT}/search?query=${encodeURIComponent(debouncedQuery)}&page=${page}`
        );

        if (isMounted && res.data.success) {
          setJobs(res.data.jobs || []);
          setTotalJobs(res.data.countJobs || (res.data.jobs ? res.data.jobs.length : 0));
          setError("");
        }
      } catch (err) {
        if (isMounted) {
          setError(err?.response?.data?.message || "Server error while fetching jobs");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
          setIsInitialLoad(false);
        }
      }
    }

    fetchJobs();

    return () => {
      isMounted = false;
    };
  }, [debouncedQuery, page]);

  const totalPages = Math.ceil(totalJobs / 8);

  return (
    <>
      <div className="bg-gray-100 min-h-screen">
        <div className="h-full flex items-center">
          <Sidebar highlightIndex={2} className="bg-gray-500" />
          <Navbar />
        </div>

        <div className="mt-10 ml-8 flex items-center gap-2">
          <input
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Search jobs..."
            className="cursor-pointer w-2/3 h-10 p-3 rounded-full border border-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          />
        </div>

        <div className="mt-10 ml-8 mr-8 flex items-center justify-between">
          <h3 className="text-3xl font-bold text-gray-800">
            {isInitialLoad && loading ? (
              <Skeleton variant="text" width={300} height={40} />
            ) : error ? (
              <span className="text-red-500">{error}</span>
            ) : !debouncedQuery ? (
              "Type to search for jobs..."
            ) : jobs.length === 0 && !loading ? (
              `No Jobs available for "${debouncedQuery}"`
            ) : (
              <>
                <span className="text-purple-700">Search Results for</span> "
                {debouncedQuery}"
                <span className="text-sm font-normal text-gray-500 ml-3">
                  ({totalJobs} {totalJobs === 1 ? "job" : "jobs"} found)
                </span>
              </>
            )}
          </h3>

          {loading && !isInitialLoad && (
            <div className="flex items-center gap-2 text-indigo-600 font-medium bg-indigo-50 px-3 py-1 rounded-full text-sm animate-pulse">
              <svg className="animate-spin h-4 w-4 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Updating results...
            </div>
          )}
        </div>

        <div className="p-10">
          {loading && jobs.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
              {Array.from({ length: 8 }).map((_, idx) => (
                <div
                  key={idx}
                  className="bg-white p-5 rounded-xl shadow-lg max-w-sm w-full flex flex-col gap-4"
                >
                  <Skeleton variant="text" width="60%" height={20} />
                  <div className="flex items-center gap-4">
                    <Skeleton variant="rounded" width={56} height={56} />
                    <div className="flex-1">
                      <Skeleton variant="text" width="80%" height={25} />
                      <Skeleton variant="text" width="60%" height={20} />
                    </div>
                  </div>
                  <Skeleton variant="text" width="100%" height={60} />
                  <Skeleton variant="rounded" width="100%" height={70} />
                  <div className="grid grid-cols-3 gap-3 mt-3">
                    <Skeleton variant="rounded" height={36} />
                    <Skeleton variant="rounded" height={36} />
                    <Skeleton variant="rounded" height={36} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 transition-opacity duration-200 ${loading ? "opacity-50 pointer-events-none" : "opacity-100"}`}>
              {jobs.map((job, idx) => (
                <JobCard
                  key={job._id || idx}
                  jobType={job.type || job.jobType}
                  salary={job.salary}
                  vacancy={job.vacancy}
                  description={job.description}
                  location={job.location}
                  companyName={job.company}
                  role={job.title}
                  datePosted={job.createdAt}
                  id={job._id}
                  companyLogo={job.logo}
                />
              ))}
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex justify-center items-center pb-10">
            <Stack spacing={2}>
              <Pagination
                count={totalPages}
                page={page}
                shape="rounded"
                onChange={(e, pageno) => {
                  setPage(pageno);
                  window.scrollTo({
                    top: 0,
                    behavior: "smooth",
                  });
                }}
              />
            </Stack>
          </div>
        )}
      </div>
      <Footer />
    </>
  );
}
