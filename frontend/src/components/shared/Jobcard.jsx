import { setUser } from "@/redux/authSlice";
import { USER_API_END_POINT } from "@/utils/address";
import {
  ArrowRightIcon,
  Bookmark,
  CheckCircle,
  Info,
  Share,
} from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import axios from "axios";
import { setJobs } from "@/redux/jobSlice";
import { useState } from "react";

export default function JobCard({
  id,
  jobType,
  salary,
  vacancy,
  description,
  location,
  companyName,
  role,
  datePosted,
  companyLogo,
}) {
  const formattedDate = new Date(datePosted).toLocaleDateString();

  const dispatch = useDispatch();
  const user = useSelector((store) => store.auth.user);
  const [isApplying, setIsApplying] = useState(false);
  const [actionType, setActionType] = useState("");
  const [isBookmarking, setIsBookmarking] = useState(false);
  const navigate = useNavigate();
  const handleShare = async (id) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Apply to this job",
          text: "Here is the link",
          url: `https://job-portal-frontend-lake.vercel.app/jobs/${id}`,
        });
      } catch (err) {
      }
    }
  };

  async function bookmarkHandler() {
    if (!user) {
      return toast.error("You must login first..", {
        duration: 2000,
        position: "top-center",
      });
    }

    setIsBookmarking(true);
    try {
      const res = await axios.post(
        `${USER_API_END_POINT}/bookmark`,
        { jobId: id },
        {
          headers: { "Content-Type": "application/json" },
          withCredentials: true,
        }
      );

      if (res.status === 201) {
        toast.success(res.data.message || "Job unsaved", {
          position: "top-center",
          duration: 2000,
        });
      }
      if (res.status === 202) {
        toast.success(res.data.message || "Job saved", {
          position: "top-center",
          duration: 2000,
        });
      }

      dispatch(
        setUser({
          ...user,
          savedJobs: res.data.savedJobs,
        })
      );
    } catch (error) {
      toast.error(error.response?.data?.message || "Something went wrong", {
        position: "top-center",
        duration: 2000,
      });
    } finally {
      setIsBookmarking(false);
    }
  }

async function applyHandler() {
  if (!user) {
    return toast.error("You must login first..", {
      duration: 2000,
      position: "top-center",
    });
  }

  if (user?.role !== "student") {
    return toast.error("You must be a student to apply...", {
      duration: 2000,
      position: "top-center",
    });
  }

  if (!user?.profile?.resume || user?.profile?.resume === "") {
    navigate("/resumepage");
    return toast.error("Please update resume to apply", {
      duration: 2000,
      position: "top-center",
    });
  }

  const alreadyApplied = user?.appliedJobs?.some((job) => job._id === id);
  setActionType(alreadyApplied ? "removing" : "applying");
  setIsApplying(true);

  try {
    const res = await axios.post(
      `${USER_API_END_POINT}/apply`,
      { jobId: id },
      {
        headers: { "Content-Type": "application/json" },
        withCredentials: true,
      }
    );

    if (res.status === 201) {
      toast.success(
        res.data.message || "Your application has been removed.",
        {
          position: "top-center",
          duration: 2000,
        }
      );
    }
    if (res.status === 202) {
      toast.success(
        res.data.message ||
        "Successfully applied to the job.\nYour profile has been send.",
        {
          position: "top-center",
          duration: 2000,
        }
      );
    }

    dispatch(
      setUser({
        ...user,
        appliedJobs: res.data.appliedJobs,
      })
    );
  } catch (error) {
    toast.error(error.response?.data?.message || "Something went wrong", {
      position: "top-center",
      duration: 2000,
    });
  } finally {
    setIsApplying(false);
    setActionType("");
  }
}

  return (
    <div className="bg-white p-5 rounded-xl shadow-lg max-w-sm w-full transition-all duration-300 hover:shadow-xl flex flex-col gap-4 justify-between">
      <div className="flex justify-between items-center">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
          Posted on {formattedDate}
        </span>

        <button
          onClick={bookmarkHandler}
          disabled={isBookmarking}
          className={`cursor-pointer hover:text-indigo-600 ${user?.savedJobs?.some((job) => job._id === id)
              ? "text-indigo-600"
              : "text-gray-400"
            } transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <Bookmark />
        </button>
      </div>

      <div className="flex items-center gap-4">
        <Link to={`/companyPage/${companyName}`}>
          <div className="w-14 h-14 flex justify-center items-center bg-gray-100 border rounded-xl overflow-hidden">
            <img
              src={
                companyLogo ||
                "https://cdn-icons-png.flaticon.com/512/6858/6858504.png"
              }
              alt="company logo"
              className="object-contain w-full h-full"
            />
          </div>
        </Link>

        <div>
          <h2 className="text-lg font-bold text-gray-800">{role}</h2>
          <p className="text-gray-500 text-sm">
            {companyName} • {location}
          </p>
        </div>
      </div>

      <p className="select-none text-sm text-gray-600 h-22 leading-relaxed overflow-hidden">
        {description}
      </p>

      <div className="flex justify-between items-center border-y border-dashed py-3 text-sm">
        <div className="text-center flex-1">
          <p className="text-gray-500 uppercase">Vacancy</p>
          <p className="font-semibold">{vacancy}</p>
        </div>
        <div className="w-px h-8 bg-gray-200"></div>
        <div className="text-center flex-1">
          <p className="text-gray-500 uppercase">Type</p>
          <p className="font-semibold text-indigo-600">{jobType}</p>
        </div>
        <div className="w-px h-8 bg-gray-200"></div>
        <div className="text-center flex-1">
          <p className="text-gray-500 uppercase">Salary</p>
          <p className="font-semibold">{salary}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mt-3 text-sm">
        <Link to={`/jobs/${id}`}>
          <button className="w-full flex items-center justify-center bg-gray-100 py-2 rounded-lg hover:bg-gray-200 transition-colors duration-200">
            <Info className="mr-1" size={16} />
            Details
          </button>
        </Link>

        <button
          onClick={() => handleShare(id)}
          className="w-full flex items-center justify-center bg-gray-100 py-2 rounded-lg hover:bg-gray-200 transition-colors duration-200"
        >
          <Share className="mr-1" size={16} />
          Share
        </button>

        <button
          type="button"
          onClick={applyHandler}
          disabled={isApplying}
          className="w-full flex items-center justify-center bg-[#8200db] text-white py-2 rounded-lg hover:bg-[#591188] transition-colors duration-200 disabled:opacity-50"
        >
          {isApplying ? (
            actionType === "removing" ? (
              "Removing..."
            ) : (
              "Applying..."
            )
          ) : user?.appliedJobs?.some((job) => job._id === id) ? (
            <>
              <CheckCircle size={16} className="mr-1" />
              Applied
            </>
          ) : (
            <>
              <ArrowRightIcon size={16} className="mr-1" />
              Apply
            </>
          )}
        </button>
      </div>
    </div >
  );
}
