import Footer from "./Footer";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import JobCard from "./Jobcard";
import { useSelector } from "react-redux";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import FilterJobs from "../ui/FilterJobs";
import PaginationRounded from "../ui/PaginationRounded";
import Skeleton from "@mui/material/Skeleton";

export default function Jobs() {
  const jobs = useSelector((state) => state.job.jobs);
  const loading = useSelector((state) => state.auth.loading);

  const [searchValue, setSearchValue] = useState("");
  const navigate = useNavigate();
  const [openFilter, setOpenFilter] = useState(false);

  const handleSearch = (queryVal) => {
    const q = (typeof queryVal === "string" ? queryVal : searchValue).trim();
    if (q) {
      navigate(`/search?query=${encodeURIComponent(q)}`, {
        state: { query: q },
      });
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") handleSearch(searchValue);
  };


  useEffect(() => {
    const trimmed = searchValue.trim();
    if (!trimmed) return;

    const timer = setTimeout(() => {
      navigate(`/search?query=${encodeURIComponent(trimmed)}`, {
        state: { query: trimmed },
      });
    }, 500);

    return () => clearTimeout(timer);
  }, [searchValue, navigate]);

  return (
    <>
      <div className="bg-gray-100 min-h-screen">
        <div className="h-full flex items-center">
          <Sidebar highlightIndex={2} />
          <Navbar />
        </div>

        <div className="mt-10 ml-8 flex items-center gap-2">
          <input
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Search jobs..."
            className="w-2/3 h-10 p-3 rounded-full border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex justify-between">
          <div className="mt-6 ml-8">
            <h3 className="text-3xl font-bold text-gray-800">
              {loading ? (
                <Skeleton variant="text" width={250} height={40} />
              ) : jobs?.length === 0 ? (
                "No Jobs available"
              ) : (
                <>
                  <span className="text-purple-700">All</span> Job Openings
                </>
              )}
            </h3>
          </div>

          <div>
            <button
              onClick={() => setOpenFilter(true)}
              className="cursor-pointer w-auto mr-5 bg-gray-400 px-5 py-2 rounded-xl whitespace-nowrap text-white font-bold hover:scale-105 transition-transform duration-200 select-none focus:scale-105 mt-5"
            >
              Filter
            </button>

            <FilterJobs
              isOpen={openFilter}
              setIsOpen={() => setOpenFilter(false)}
            />
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
            {loading
              ? Array.from({ length: 8 }).map((_, index) => (
                  <div
                    key={index}
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
                ))
              : jobs?.map((job, idx) => (
                  <JobCard
                    key={idx}
                    jobType={job.jobType}
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
        </div>

        <div className="flex justify-center items-center p-5">
          <PaginationRounded />
        </div>
      </div>
      <Footer />
    </>
  );
}
