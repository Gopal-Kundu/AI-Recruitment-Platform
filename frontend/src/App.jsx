import { createBrowserRouter, RouterProvider } from "react-router-dom";
import Homepage from "./components/shared/Homepage";
import Login from "./components/auth/Login";
import SignUp from "./components/auth/SignUp";
import Profile from "./components/shared/Profile";
import Jobs from "./components/shared/Jobs";
import ResumePage from "./components/shared/ResumePage";
import SavedJobs from "./components/shared/SavedJobs";
import JobDescription from "./components/shared/JobDescription";
import CompanyListPage from "./components/shared/CompanyListPage";
import ApplicationsList from "./components/shared/ApplicationList";
import CompanyPage from "./components/shared/CompanyPage";
import ApplicationPage from "./components/ui/ApplicationPage";
import SearchJob from "./components/shared/SearchJob";
import ErrorPage from "./components/shared/ErrorPage";
import NotificationPage from "./components/shared/NotificationPage";
import CompanySearch from "./components/shared/CompanySearch";
import InterviewPrep from "./components/shared/InterviewPrep";
import Dashboard from "./components/shared/Dashboard";
import InterviewQAPage from "./components/shared/InterviewQAPage";
import AiRecommendations from "./components/shared/AiRecommendations";
import JdResumeList from "./components/shared/JdResumeList";
import JdResumeDetail from "./components/shared/JdResumeDetail";

const appRouter = createBrowserRouter([
  { path: "/", element: <Homepage /> },
  { path: "/login", element: <Login /> },
  { path: "/jobs/:id", element: <JobDescription /> },
  { path: "/signup", element: <SignUp /> },
  { path: "/companies", element: <CompanyListPage /> },
  { path: "/jobs", element: <Jobs /> },
  { path: "/profile", element: <Profile /> },
  { path: "/resumepage", element: <ResumePage /> },
  { path: "/savedjobs", element: <SavedJobs /> },
  { path: "/applications/:id", element: <ApplicationsList /> },
  { path: "/company/:id", element: <CompanyPage /> },
  { path: "/view-application/:id", element: <ApplicationPage /> },
  { path: "/search", element: <SearchJob /> },
  { path: "/notifications", element: <NotificationPage /> },
  { path: "/companypage/:name", element: <CompanySearch /> },
  { path: "*", element: <ErrorPage /> },
  { path: "/interviewPrep", element: <InterviewPrep/>},
  { path: "/interviewPrep/dashboard", element: <Dashboard/>},
  { path: "/interviewPrep/dashboard/:id", element: <InterviewQAPage/>},
  { path: "/interviewPrep/jd-resume", element: <JdResumeList /> },
  { path: "/interviewPrep/jd-resume/:id", element: <JdResumeDetail /> },
  { path: "/ai-recommendation", element: <AiRecommendations />}
]);

function App() {
  return <RouterProvider router={appRouter} />;
}

export default App;
