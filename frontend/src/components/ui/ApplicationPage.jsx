import React from "react";
import { useSelector } from "react-redux";
import { useParams } from "react-router-dom";

function ApplicationPage() {
  const { id } = useParams();
  const applications = useSelector((state) => state?.applicant?.applicants);
  const user = applications?.find((app) => app._id === id);

  const skillsArray =
    user?.profile?.skills?.length > 0 ? user?.profile?.skills?.split(",") : [];

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Profile */}
        <div className="md:col-span-1 flex flex-col items-center md:items-start space-y-6">
          <div className="bg-white rounded-lg shadow-md p-6 w-full text-center md:text-left">
            <div className="relative inline-block mb-4">
              <div
                className="bg-center bg-no-repeat bg-cover rounded-full h-32 w-32 mx-auto md:mx-0 ring-4 ring-primary-100"
                style={{
                  backgroundImage: `url("${
                    user?.profile?.profilePhoto ||
                    "https://www.refugee-action.org.uk/wp-content/uploads/2016/10/anonymous-user.png"
                  }")`,
                }}
              />
            </div>

            <h2 className="text-2xl font-bold text-gray-900">
              {user?.fullname || "Anonymous User"}
            </h2>

            <p className="text-md text-gray-600 mb-4">
              {user?.profile?.bio || "No bio available"}
            </p>

            <div className="flex justify-center md:justify-start flex-wrap gap-2 mb-4">
              {skillsArray.map((skill, i) => (
                <span
                  key={i}
                  className="rounded-full bg-gray-300 px-3 py-1 text-sm font-medium text-gray-700 active:scale-90 transition-transform"
                >
                  {skill.trim()}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="md:col-span-2 bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">Resume</h3>
          {user?.profile?.resume ? (
            <iframe
              src={user?.profile?.resume}
              title="Resume"
              className="w-full h-[600px] rounded border"
            />
          ) : (
            <p className="text-gray-500 text-center py-16">
              No resume provided.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default ApplicationPage;
