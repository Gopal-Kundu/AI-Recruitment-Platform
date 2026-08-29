import JobPortal from "./JobPortal";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@radix-ui/react-popover";
import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { setNotificationCount, setLoading, setUser } from "@/redux/authSlice";
import { useLogout } from "../auth/useLogout";
import { useEffect } from "react";
import axios from "axios";
import { USER_API_END_POINT } from "@/utils/address";
import Skeleton from "@mui/material/Skeleton";

const navLinks = [
  { name: "Home", path: "/" },
  { name: "Jobs", path: "/Jobs" },
  { name: "My resume", path: "/resumepage" },
  { name: "Saved Jobs", path: "/savedjobs" },
  { name: "Companies", path: "/companies" },
  { name: "Interview Prep", path: "/interviewPrep"},
  { name: "AI Recommendation", path: "/ai-recommendation"}
];

export default function Navbar() {
  const logout = useLogout();
  const dispatch = useDispatch();
  const user = useSelector((store) => store.auth.user);
  const loading = useSelector((store) => store.auth.loading);
  const notificationCount = useSelector((store)=> store.auth.notificationCount);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserIfLoggedIn = async () => {
      if (user) return;
      try {
        dispatch(setLoading(true));
        const res = await axios.get(`${USER_API_END_POINT}/remember`, {
          withCredentials: true,
        });
        if (res.data.success) {
          dispatch(setUser(res.data.user));
          dispatch(
            setNotificationCount(
              res.data.user.notifications.newMessageCount
            )
          );
        }
      } catch (err) {
        
      } finally {
        dispatch(setLoading(false));
      }
    };

    fetchUserIfLoggedIn();
  }, [dispatch]);

  return (
    <div className="bg-gray-50 select-none w-full h-14">
      <header className="flex justify-between items-center px-4 py-2 relative z-[999]">
        <div className="relative z-20">
          <JobPortal />
        </div>

        <nav className="hidden md:flex items-center gap-10 text-xl font-semibold">
          {loading ? (
            <div className="flex items-center gap-8">
              <Skeleton variant="text" width={60} height={28} />
              <Skeleton variant="text" width={50} height={28} />
              <Skeleton variant="text" width={85} height={28} />
              <Skeleton variant="text" width={80} height={28} />
            </div>
          ) : (
            navLinks?.map((link, idx) => {
              if (!user && (idx === 2 || idx === 3 || idx === 4 || idx === 6)) return null;
              if (user?.role === "student" && idx === 4) return null;
              return (
                <Link
                  key={idx}
                  className="text-gray-600 hover:text-gray-900 active:scale-90 transition-transform duration-150"
                  to={link.path}
                >
                  {link.name}
                </Link>
              );
            })
          )}
        </nav>

        {loading ? (
          <div className="flex items-center gap-3">
            <Skeleton variant="circular" width={28} height={28} />
            <Skeleton variant="circular" width={34} height={34} />
          </div>
        ) : user ? (
          <div className="flex items-center gap-5">
            {user && (
              <div
                className="relative cursor-pointer"
                onClick={() => navigate("/notifications")}
              >
                <Bell className="w-6 h-6" onClick={()=>dispatch(setNotificationCount(0))}/>

                {notificationCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    {notificationCount}
                  </span>
                )}
              </div>
            )}

            <Popover>
              <PopoverTrigger>
                <div className="flex items-center cursor-pointer hover:scale-105 transition-transform duration-200 relative z-20">
                  <img
                    alt="User Avatar"
                    className="w-8 h-8 rounded-full"
                    src={
                      user?.profile?.profilePhoto ||
                      "https://www.refugee-action.org.uk/wp-content/uploads/2016/10/anonymous-user.png"
                    }
                  />
                </div>
              </PopoverTrigger>

              <PopoverContent className="bg-white rounded-lg shadow-md p-4 w-56 relative z-[9999]">
                <div className="py-2 border-b">
                  <p className="font-semibold text-gray-800">
                    {user?.fullname}
                  </p>
                  <p className="text-sm text-gray-500">
                    {user?.profile?.bio || "No Bio"}
                  </p>
                </div>

                <Link
                  className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 rounded"
                  to="/profile"
                >
                  <span className="material-icons">visibility</span>
                  <span>View Profile</span>
                </Link>

                <button
                  className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 rounded w-full text-left cursor-pointer"
                  onClick={logout}
                >
                  <span className="material-icons">logout</span>
                  <span>Logout</span>
                </button>
              </PopoverContent>
            </Popover>
          </div>
        ) : (
          <div className="flex gap-3 items-center">
            <Link to="/signup">
              <span className="p-1 px-3 bg-gray-600 rounded-2xl text-white text-lg cursor-pointer hover:bg-black transition-transform duration-150 active:scale-90">
                Sign Up
              </span>
            </Link>

            <Link to="/login">
              <span className="p-1 px-3 bg-purple-800 rounded-2xl text-white text-lg cursor-pointer hover:bg-purple-900 transition-transform duration-150 active:scale-90">
                Login
              </span>
            </Link>
          </div>
        )}
      </header>
    </div>
  );
}
