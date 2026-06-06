const User = require("../models/user.model");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const getDataUri = require("../utils/datauri");
const cloudinary = require("../utils/cloudinary");
const Job = require("../models/job.model");
const Notification = require("../models/notification.model");
const DashBoardPosition = require("../models/dashboard.model");
const JobDescriptionWiseResume = require("../models/jobDescriptionWiseResume.model");
const { extractText, getDocumentProxy } = require("unpdf");
const chromium = require("@sparticuz/chromium");
const { aiApi, parseGeminiJSON } = require("./ai.controller");
require("dotenv").config({ quiet: true });

// Helper to fetch and extract text and links from a PDF URL
const extractTextFromPdf = async (url) => {
  const buffer = await fetch(url).then(res => res.arrayBuffer());
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });

  const links = new Set();

  // 1. Try to extract from annotations
  try {
    const numPages = pdf.numPages;
    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i);
      const annotations = await page.getAnnotations();
      if (annotations && Array.isArray(annotations)) {
        for (const annot of annotations) {
          if (annot && annot.subtype === 'Link' && annot.url) {
            links.add(annot.url);
          }
        }
      }
    }
  } catch (err) {
    console.error("Error extracting PDF annotations:", err);
  }

  if (text) {
    // 2. Extract using regex from text
    const urlMatches = text.match(/https?:\/\/[^\s"'()]+/gi) || [];
    urlMatches.forEach(url => {
      const cleaned = url.replace(/[.,;:]+$/, '');
      if (cleaned) links.add(cleaned);
    });

    const githubMatches = text.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/[a-zA-Z0-9-_\.]+(?:\/[a-zA-Z0-9-_\.]+)?/gi) || [];
    githubMatches.forEach(url => {
      let cleaned = url.replace(/[.,;:]+$/, '');
      if (cleaned) {
        if (!cleaned.startsWith('http')) {
          cleaned = 'https://' + cleaned;
        }
        links.add(cleaned);
      }
    });

    const linkedinMatches = text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9-_\.]+/gi) || [];
    linkedinMatches.forEach(url => {
      let cleaned = url.replace(/[.,;:]+$/, '');
      if (cleaned) {
        if (!cleaned.startsWith('http')) {
          cleaned = 'https://' + cleaned;
        }
        links.add(cleaned);
      }
    });
  }

  return { text, links: Array.from(links) };
};


const register = async (req, res) => {
  try {
    const { fullname, email, phonenumber, password, role } = req.body;

    if (!fullname || !email || !phonenumber || !password || !role) {
      return res.status(400).json({
        message: "All fields are required. Please fill in every field.",
        success: false,
      });
    }

    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({
        message: "An account with this email already exists. Please login instead.",
        success: false,
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await User.create({
      fullname,
      email,
      phonenumber,
      password: hashedPassword,
      role,
    });

    return res.status(201).json({
      message: "Account created successfully! Please login to continue.",
      success: true,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error. Please try again later.", success: false });
  }
};

const login = async (req, res) => {
  try {
    const { email, password, role } = req.body;
    if (!email || !password || !role) {
      return res.status(400).json({
        message: "Email, password and role are all required.",
        success: false,
      });
    }

    let user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({
        message: "No account found with this email. Please sign up first.",
        success: false,
      });
    }

    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) {
      return res.status(400).json({
        message: "Incorrect password. Please try again.",
        success: false,
      });
    }

    if (role !== user.role) {
      return res.status(400).json({
        message: `No account exist with current role.`,
        success: false,
      });
    }

    const tokenData = {
      userId: user._id,
      role: user.role
    };
    const token = jwt.sign(tokenData, process.env.SECRET_KEY, {
      expiresIn: "2d",
    });
    user.loggedIn = true;
    await user.save();
    await user.populate("createdCompanies");
    await user.populate("savedJobs");
    await user.populate("postedJobs");
    await user.populate("appliedJobs");
    await user.populate("notifications");
    await user.populate("recruiterNotification");
    const userData = {
      _id: user._id,
      fullname: user.fullname,
      email: user.email,
      createdCompanies: user.createdCompanies,
      phonenumber: user.phonenumber,
      role: user.role,
      profile: user.profile,
      savedJobs: user.savedJobs,
      postedJobs: user.postedJobs,
      appliedJobs: user.appliedJobs,
      notifications: user.role === "recruiter" ? user.recruiterNotification : user.notifications,
    };

    return res
      .status(200)
      .cookie("token", token, {
        maxAge: 2 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: "none",
        secure: true,
      })
      .json({
        message: `Welcome back ${user.fullname}`,
        user: userData,
        success: true,
      });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error", success: false });
  }
};

const logout = async (req, res) => {
  try {
    let user = await User.findById(req.id);
    user.loggedIn = false;
    await user.save();
    res.status(200).clearCookie("token", {
      maxAge: 0,
      httpOnly: true,
      sameSite: "none",
      secure: true,
    }).json({
      message: "Logged Out Successfully",
      success: true,
    })
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error", success: false });
  }
};

const updateProfile = async (req, res) => {
  const { fullname, role, phonenumber, bio, skills } = req.body;

  const fileResume = req.files?.resume?.[0];
  const profilePhoto = req.files?.profilePhoto?.[0];

  let fileResumeCloudResponse;
  let profilePhotoCloudResponse;

  try {
    if (fileResume) {
      const fileResumeUri = getDataUri(fileResume);
      fileResumeCloudResponse = await cloudinary.uploader.upload(
        fileResumeUri.content,
        {
          folder: "Job Portal Uploads/Resumes",
          resource_type: "auto",
        }
      );
    }

    if (profilePhoto) {
      const fileProfilePhotoUri = getDataUri(profilePhoto);
      profilePhotoCloudResponse = await cloudinary.uploader.upload(
        fileProfilePhotoUri.content,
        {
          folder: "Job Portal Uploads/Profile Photos",
          resource_type: "auto",
        }
      );
    }

    const user = await User.findById(req.id);
    if (!user)
      return res
        .status(404)
        .json({ message: "User not found", success: false });

    if (fullname) user.fullname = fullname;
    if (role) user.role = role;
    if (phonenumber) user.phonenumber = phonenumber;
    if (bio) user.profile.bio = bio;
    if (skills) user.profile.skills = skills;

    if (profilePhotoCloudResponse) {
      user.profile.profilePhoto = profilePhotoCloudResponse.secure_url;
    }
    if (fileResumeCloudResponse) {
      user.profile.resume = fileResumeCloudResponse.secure_url;
    }

    await user.save();

    return res.status(200).json({ success: true, user });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Server Error", error: error.message });
  }
};

const applyJobs = async (req, res) => {
  const id = req.id;
  if (!id) {
    return res
      .status(400)
      .json({ success: false, message: "User is not authenticated" });
  }

  const { jobId } = req.body;

  const job = await Job.findById(jobId);
  if (!job)
    return res.status(400).json({ success: false, message: "No Job Found." });

  const user = await User.findById(id);

  if (user.appliedJobs.includes(jobId)) {
    user.appliedJobs.pull(jobId);
    await user.save();
    job.applications.pull(id);
    await job.save();

    const populatedUser = await user.populate("appliedJobs");
    const allJobs = await Job.find();

    return res.status(201).json({
      success: true,
      message: "Your application has been removed.",
      appliedJobs: populatedUser.appliedJobs,
      allJobs,
      job,
    });
  }

  user.appliedJobs.push(jobId);
  await user.save();

  job.applications.push(id);
  await job.save();

  // Send Notification to Recruiter
  try {
    const recruiterId = job?.createdBy;
    if (recruiterId) {
      const recruiter = await User.findById(recruiterId);

      if (recruiter) {
        let notificationSchemaId = recruiter.recruiterNotification;

        let notificationSchema = null;
        if (notificationSchemaId) {
          notificationSchema = await Notification.findById(notificationSchemaId);
        }

        const messageText = `${user?.fullname || "Someone"} applied for the job "${job?.title || "Untitled"}" at "${job?.company || "Unknown Company"}"`;
        const senderPhoto = user?.profile?.profilePhoto || "https://www.refugee-action.org.uk/wp-content/uploads/2016/10/anonymous-user.png";

        if (!notificationSchema) {
          const newNotification = await Notification.create({
            allMessages: [{
              message: messageText,
              time: new Date(),
              companyLogo: senderPhoto,
            }],
            newMessageCount: 1,
          });

          const updatedRecruiter = await User.findByIdAndUpdate(recruiterId, { recruiterNotification: newNotification._id }, { returnDocument: 'after' });
        } else {
          notificationSchema.allMessages.push({
            message: messageText,
            time: new Date(),
            companyLogo: senderPhoto,
          });
          notificationSchema.newMessageCount += 1;
          const savedSchema = await notificationSchema.save();
        }
      }
    }
  } catch (notificationErr) {
    console.error("Something wrong");
  }

  const populatedUser = await user.populate("appliedJobs");

  const allJobs = await Job.find();

  return res.status(202).json({
    success: true,
    message: "Applied Successfully.",
    appliedJobs: populatedUser.appliedJobs,
    allJobs,
    job,
  });
};

const bookmark = async (req, res) => {
  const id = req.id;
  if (!id) {
    return res
      .status(400)
      .json({ success: false, message: "User is not authenticated" });
  }

  const { jobId } = req.body;

  const job = await Job.findById(jobId);
  if (!job)
    return res.status(400).json({ success: false, message: "No Job Found." });

  const user = await User.findById(id);

  if (user.savedJobs.includes(jobId)) {
    user.savedJobs.pull(jobId);
    await user.save();

    const populatedUser = await user.populate("savedJobs");
    const allJobs = await Job.find();

    return res.status(201).json({
      success: true,
      message: "Job Unsaved",
      savedJobs: populatedUser.savedJobs,
      allJobs,
      job,
    });
  }

  user.savedJobs.push(jobId);
  await user.save();

  const populatedUser = await user.populate("savedJobs");

  const allJobs = await Job.find();

  return res.status(202).json({
    success: true,
    message: "Saved",
    savedJobs: populatedUser.savedJobs,
    allJobs,
    job,
  });
};

const remember = async (req, res) => {
  try {
    const userId = req.id;

    const user = await User.findById(userId)
      .populate("createdCompanies")
      .populate("savedJobs")
      .populate("appliedJobs")
      .populate("postedJobs")
      .populate("notifications")
      .populate("recruiterNotification")
      .select("-password");

    if (!user || !user.loggedIn) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const userData = user.toObject();
    if (user.role === "recruiter") {
      userData.notifications = user.recruiterNotification;
    }

    return res.status(200).json({
      success: true,
      user: userData
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

const getNotifications = async (req, res) => {
  try {
    const userId = req.params.userId;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const isRecruiter = user.role === "recruiter";
    const notificationId = isRecruiter ? user.recruiterNotification : user.notifications;

    if (!notificationId) {
      return res.status(200).json({
        success: true,
        message: "No notifications yet",
        notifications: {
          allMessages: [],
          newMessageCount: 0,
        },
      });
    }

    const notifications = await Notification.findByIdAndUpdate(
      notificationId,
      { $set: { newMessageCount: 0 } },
      { returnDocument: 'after' }
    );

    if (!notifications) {
      return res.status(200).json({
        success: true,
        message: "No notifications found",
        notifications: {
          allMessages: [],
          newMessageCount: 0,
        },
      });
    }

    return res.status(200).json({
      success: true,
      message: "Notifications fetched successfully",
      notifications,
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};


const deleteResume = async (req, res) => {
  try {
    const userId = req.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.profile.resume) {
      return res.status(400).json({
        success: false,
        message: "No resume to delete",
      });
    }

    user.profile.resume = "";
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Resume deleted successfully",
      user,
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};


const createInterviewPrep = async (req, res) => {
  try {
    const { title, yearsofexperience, skills, description } = req.body;
    const id = req.id;

    const newPosition = await DashBoardPosition.create({
      Title: title,
      YearsOfExperience: yearsofexperience,
      skills,
      description,
      QuestionsWithAnswer: [],
    });

    await User.findByIdAndUpdate(
      id,
      { $push: { interviewPrep: newPosition._id } },
      { returnDocument: 'after' }
    );

    const prompt = `
Generate 10 interview questions and answers in JSON format.

Role: ${title}
Experience: ${yearsofexperience}
Skills: ${skills}
Description: ${description}

Return format:
[
  {
    "Qs": "question here",
    "Ans": "answer here"
  }
]
`;

    const aiResponse = await aiApi(prompt);

    const parsedData = parseGeminiJSON(aiResponse);

    newPosition.QuestionsWithAnswer = parsedData;
    await newPosition.save();

    return res.status(201).json({
      success: true,
      message: "Interview prep created successfully",
      data: newPosition,
    });

  } catch (error) {
    console.error("Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};


const getInterviewPrep = async (req, res) => {
  try {
    const userId = req.id;

    const user = await User.findById(userId)
      .populate("interviewPrep");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: user.interviewPrep,
    });

  } catch (error) {
    console.error("Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

const deleteInterviewPrep = async (req, res) => {
  try {
    const userId = req.id;
    const { dashboardId } = req.body;

    if (!dashboardId) {
      return res.status(400).json({
        success: false,
        message: "Dashboard ID is required",
      });
    }

    const deleted = await DashBoardPosition.findByIdAndDelete(dashboardId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Dashboard not found",
      });
    }

    await User.findByIdAndUpdate(
      userId,
      { $pull: { interviewPrep: dashboardId } },
      { returnDocument: 'after' }
    );

    return res.status(200).json({
      success: true,
      message: "Interview prep deleted successfully",
    });

  } catch (error) {
    console.error("Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};


const generateMoreQuestions = async (req, res) => {
  try {
    const { dashboardId } = req.body;

    const dashboard = await DashBoardPosition.findById(dashboardId);

    if (!dashboard) {
      return res.status(404).json({
        success: false,
        message: "Dashboard not found",
      });
    }

    const previousQuestions = dashboard.QuestionsWithAnswer
      .map((q, index) => `${index + 1}. ${q.Qs}`)
      .join("\n");

    const prompt = `
You are an expert interviewer.

Generate 10 NEW interview questions and answers.

Role: ${dashboard.Title}
Experience: ${dashboard.YearsOfExperience}
Skills: ${dashboard.skills}
Description: ${dashboard.description}

Already asked questions (DO NOT repeat these):
${previousQuestions}

STRICT RULES:
- Do NOT repeat any question
- Questions must be different and unique
- Keep answers clear and structured
- Return ONLY JSON

FORMAT:
[
  {
    "Qs": "question",
    "Ans": "answer"
  }
]
`;

    const aiResponse = await aiApi(prompt);
    let parsedData = parseGeminiJSON(aiResponse);
    parsedData = parsedData.slice(0, 10);
    dashboard.QuestionsWithAnswer.push(...parsedData);

    await dashboard.save();

    return res.status(200).json({
      success: true,
      message: "10 new unique questions added",
      data: parsedData,
    });

  } catch (error) {
    console.error("Generate Qs Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to generate questions",
    });
  }
};
const uploadResume = async (req, res) => {
  try {
    const userId = req.id;
    const fileResume = req.file;

    if (!fileResume) {
      return res.status(400).json({ success: false, message: "No resume file provided" });
    }

    const fileResumeUri = getDataUri(fileResume);
    const fileResumeCloudResponse = await cloudinary.uploader.upload(
      fileResumeUri.content,
      {
        folder: "Job Portal Uploads/Resumes",
        resource_type: "auto",
      }
    );

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    user.profile.resume = fileResumeCloudResponse.secure_url;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Resume uploaded successfully",
      user,
    });
  } catch (error) {
    console.error("Resume upload error:", error);
    return res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message
    });
  }
};

const createJdResume = async (req, res) => { //This is for create folder on JD page
  try {
    const { companyName, jobDescription } = req.body;
    const userId = req.id;

    if (!companyName || !jobDescription) {
      return res.status(400).json({
        success: false,
        message: "Company name and job description are required",
      });
    }

    const newJdResume = await JobDescriptionWiseResume.create({
      companyName,
      jobDescription,
      userId,
    });

    await User.findByIdAndUpdate(
      userId,
      { $push: { jobDescriptionWiseResume: newJdResume._id } },
      { returnDocument: 'after' }
    );

    return res.status(201).json({
      success: true,
      message: "Job description entry created successfully",
      data: newJdResume,
    });
  } catch (error) {
    console.error("Error creating JD resume:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

const getJdResumes = async (req, res) => {
  try {
    const userId = req.id;
    const resumes = await JobDescriptionWiseResume.find({ userId }).sort({ createdAt: -1 });
    return res.status(200).json({
      success: true,
      data: resumes,
    });
  } catch (error) {
    console.error("Error fetching JD resumes:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

const getJdResumeById = async (req, res) => {
  try {
    const { id } = req.params;
    const resume = await JobDescriptionWiseResume.findById(id);
    if (!resume) {
      return res.status(404).json({
        success: false,
        message: "Job Description wise resume entry not found",
      });
    }
    return res.status(200).json({
      success: true,
      data: resume,
    });
  } catch (error) {
    console.error("Error fetching JD resume by id:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

const deleteJdResume = async (req, res) => {
  try {
    const userId = req.id;
    const { id } = req.params;

    const deleted = await JobDescriptionWiseResume.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Job Description wise resume entry not found",
      });
    }

    await User.findByIdAndUpdate(
      userId,
      { $pull: { jobDescriptionWiseResume: id } },
      { returnDocument: 'after' }
    );

    return res.status(200).json({
      success: true,
      message: "Job description entry deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting JD resume:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

const analyzeExistingResumeForJd = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.id;

    const jdResume = await JobDescriptionWiseResume.findById(id);
    if (!jdResume) {
      return res.status(404).json({
        success: false,
        message: "Job description entry not found",
      });
    }

    const user = await User.findById(userId);
    if (!user || !user.profile.resume) {
      return res.status(400).json({
        success: false,
        message: "NO_RESUME",
      });
    }

    // Extract text from the existing user resume
    const { text: rawResumeText } = await extractTextFromPdf(user.profile.resume);
    // Truncate to avoid Gemini token overflow (500 Internal Error)
    const resumeText = rawResumeText;
    const jobDescText = jdResume.jobDescription;

    const prompt = `
You are an expert ATS (Applicant Tracking System) parser and career coach.
Analyze the user's resume against the target Job Description.

User Resume Text:
${resumeText}

Job Description:
${jobDescText}

Provide a detailed evaluation in JSON format:
{
  "atsScore": 75,
  "weakSpots": "List of areas where the resume is lacking skills, keywords, or structure relative to the job description."
}

Return ONLY raw JSON. Do not include markdown code block styling like \`\`\`json or \`\`\`.
`;

    const aiResponse = await aiApi(prompt);
    const parsed = parseGeminiJSON(aiResponse);

    jdResume.initialATSScore = parsed.atsScore ?? 0;
    const weakSpots = parsed.weakSpots ?? "None identified.";
    jdResume.WeakSpotInResume = weakSpots;

    // SECOND API CALL: Dedicated explicitly for generating highly detailed learning recommendations
    const learningPrompt = `
You are an elite Tech Career Coach. Based on the following weak spots identified in a candidate's resume for a specific job, recommend highly detailed YouTube searches to bridge the gap.

Job Description:
${jobDescText}

Identified Weak Spots:
${weakSpots}

CRITICAL: Do NOT focus on generic paid courses. Focus heavily on YouTube. You MUST provide at least 10-15 highly specific YouTube search titles/queries that the candidate can search to learn these exact skills.

Return ONLY raw JSON. Do not include markdown code block styling.
{
  "recommendedYoutubeSearchesAndCourses": "Provide a highly detailed, markdown-formatted list of 10-15 YouTube searches. Use numbers and bullets. Format exactly like this:\\n\\n### Recommended Courses\\n1. **[Course Name]** on [Platform] - *[1-sentence reason]*\\n\\n### What to Search on YouTube (10-15 exact queries)\\n1. **\\\"[Exact Search Query 1]\\\"** - *[Detailed explanation of what this will teach you and why it is vital for this specific job description]*\\n2. **\\\"[Exact Search Query 2]\\\"** - *[Detailed explanation]*"
}
`;

    const learningResponse = await aiApi(learningPrompt);
    const learningParsed = parseGeminiJSON(learningResponse);

    // Ensure it's a string even if Gemini returns an array
    let recommended = learningParsed.recommendedYoutubeSearchesAndCourses || "None recommended.";
    if (Array.isArray(recommended)) {
      recommended = recommended.join('\\n');
    }
    jdResume.recomendedYoutubeSearchesAndCourses = recommended;
    await jdResume.save();

    return res.status(200).json({
      success: true,
      message: "Analysis completed successfully",
      data: jdResume,
    });
  } catch (error) {
    console.error("Error analyzing resume:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during analysis",
      error: error.message,
    });
  }
};

const generateAtsResume = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.id;

    const jdResume = await JobDescriptionWiseResume.findById(id);

    if (!jdResume) {
      return res.status(404).json({
        success: false,
        message: "Job description entry not found",
      });
    }

    const user = await User.findById(userId);

    if (!user || !user.profile.resume) {
      return res.status(400).json({
        success: false,
        message: "NO_RESUME",
      });
    }

    const { text: rawResumeText, links: extractedLinks } = await extractTextFromPdf(user.profile.resume);

    const resumeText = rawResumeText;
    const jobDescText = jdResume.jobDescription;

    const jsonPrompt = `
You are an expert Applicant Tracking System (ATS) optimization specialist and a veteran recruiter. Your task is to rewrite the candidate's resume so that it aligns COMPLETELY with the target Job Description and Company (if provided). Focus on generating a highly detailed, comprehensive, and keyword-rich resume that passes advanced ATS filters with a near-perfect match rate.

TARGET COMPANY NAME: ${jdResume.companyName || 'Not Specified'}
TARGET JOB DESCRIPTION:
${jobDescText}

INSTRUCTIONS FOR ATS OPTIMIZATION:
1. COMPLETE ALIGNMENT & KEYWORDS:
   - Carefully extract all technical skills, soft skills, domain keywords, tools, frameworks, methodologies, and terminology from the Target Job Description.
   - Infuse these strong keywords naturally but heavily throughout the professional summary, technical skills categories, experience bullet points, and projects.
   - If a Target Company Name is provided, tailor the resume's tone, emphasis, and focus areas to align with the company's industry, culture, tech stack, and goals.

2. DEPTH & DETAIL REQUIREMENT:
   - Ensure the resume is extremely detailed and robust. Avoid high-level summaries or brief bullet points.
   - For every single role in "experience" and project in "projects", expand and rewrite their descriptions to explain what was built, how it was built (technologies, architecture, design decisions), and the value it delivered.
   - Every experience and project MUST have at least 3 to 4 detailed, fully-formed bullet points. Do NOT leave them empty, condensed, or stubbed.

3. REALISTIC & DIGESTIBLE METRICS:
   - Do NOT use exaggerated, implausible, or excessively high-fi metrics (such as "saved $20M in costs" or "improved response times by 99%" on a side project or mid-level job) that would trigger suspicion from a recruiter.
   - Instead, use realistic, believable, and digestible metrics (e.g., "improved query execution times by 15-20%", "achieved 90%+ unit test coverage", "reduced API latency by 120ms", "boosted page load speed by 25%", "successfully managed a repository with 50+ active daily commits"). Keep them grounded, context-appropriate, and professional.

CANDIDATE RESUME:
${resumeText}

EXTRACTED LINKS FROM CANDIDATE RESUME:
${extractedLinks && extractedLinks.length > 0 ? extractedLinks.join('\n') : 'None identified'}

RETURN EXACTLY THIS JSON FORMAT (No extra text, no markdown block formatting, just the raw JSON structure):
{
  "name": "Candidate Full Name",
  "atsScore": 98,
  "contact": {
    "phone": "+91-XXXXXXXXXX",
    "email": "email@example.com",
    "linkedin": "[linkedin.com/in/profile](https://linkedin.com/in/profile)",
    "github": "[github.com/username](https://github.com/username)",
    "portfolio": "https://...",
    "codingprofile": "https://..."
  },
  "summary": "Detailed, high-impact, keyword-rich professional summary mirroring the target JD and aligning with the company.",
  "skills": [
    {
      "category": "Frontend/Backend/Database/DevOps/Languages etc.",
      "items": "React.js, Redux, and other key target skills extracted from the JD"
    }
  ],
  "experience": [
    {
      "company": "Company Name",
      "location": "Location",
      "role": "Role Title",
      "dates": "Month Year - Month Year",
      "bullets": [
        "First highly detailed, ATS-keyword-optimized bullet point aligned with the target JD and company using a realistic, digestible metric.",
        "Second detailed bullet point detailing technologies, design decisions, and real-world responsibilities.",
        "Third detailed bullet point explaining problem-solving and collaboration details.",
        "Fourth detailed bullet point demonstrating impact using digestible, believable metrics."
      ]
    }
  ],
  "projects": [
    {
      "name": "Project Name",
      "technologies": "React, Node.js, MongoDB, TailwindCSS, etc.",
      "github": "https://github.com/...",
      "liveLink": "https://...",
      "bullets": [
        "First detailed project bullet explaining the architecture, core feature engineered, and the problem solved using JD-specific keywords.",
        "Second detailed project bullet outlining technologies, APIs, database integration, or state management details.",
        "Third detailed project bullet describing optimization, testing, deployment, and a digestible metric of success.",
        "Fourth detailed project bullet (highly recommended for depth) demonstrating specific implementation challenges overcome."
      ]
    }
  ],
  "achievements": [
    "Achievement text aligned with industry success and target keywords"
  ],
  "education": [
    {
      "institution": "University Name",
      "location": "City",
      "degree": "Degree Name | CGPA: X.X or Percentage",
      "dates": "Month Year - Month Year"
    }
  ]
}
`;

    const rawJson = await aiApi(jsonPrompt);

    const resumeData = parseGeminiJSON(rawJson);

    const estimatedScore = resumeData.atsScore ?? 95;

    delete resumeData.atsScore;

    jdResume.AtsResumeJson = JSON.stringify(resumeData, null, 2);

    jdResume.ATSScoreOfResume = estimatedScore;

    await jdResume.save();

    return res.status(200).json({
      success: true,
      message: "Tailored ATS Resume created successfully",
      data: jdResume,
    });
  } catch (error) {
    console.error("Error generating ATS resume:", error);

    return res.status(500).json({
      success: false,
      message: "Server error during ATS resume generation",
      error: error.message,
    });
  }
};


/**
 * generateResumePdf
 * POST /jd-resume/:id/pdf
 * Uses puppeteer-core + system Chrome to render the ATS resume JSON
 * as an A4 PDF and stream it back to the client.
 */
const generateResumePdf = async (req, res) => {
  let browser = null;
  try {
    const { id } = req.params;
    const { baseFontSize = 8.5, baseFontFamily = 'Lora' } = req.body;

    const { default: puppeteer } = await import("puppeteer-core");

    // 1. Fetch the JD-resume record
    const jdResume = await JobDescriptionWiseResume.findById(id);
    if (!jdResume || !jdResume.AtsResumeJson) {
      return res.status(404).json({ success: false, message: "ATS resume data not found" });
    }

    // 2. Parse the stored resume JSON
    let resumeData;
    try {
      resumeData = JSON.parse(jdResume.AtsResumeJson);
    } catch (e) {
      return res.status(400).json({ success: false, message: "Invalid resume JSON stored" });
    }

    const getFontFamilyCSS = (fontName) => {
      switch(fontName) {
        case 'Inter': return '"Inter", sans-serif';
        case 'Roboto': return '"Roboto", sans-serif';
        case 'Merriweather': return '"Merriweather", serif';
        case 'Open Sans': return '"Open Sans", sans-serif';
        case 'EB Garamond': return '"EB Garamond", serif';
        case 'Montserrat': return '"Montserrat", sans-serif';
        case 'Poppins': return '"Poppins", sans-serif';
        case 'Lato': return '"Lato", sans-serif';
        case 'Ubuntu': return '"Ubuntu", sans-serif';
        case 'Nunito': return '"Nunito", sans-serif';
        case 'Raleway': return '"Raleway", sans-serif';
        case 'PT Sans': return '"PT Sans", sans-serif';
        case 'PT Serif': return '"PT Serif", serif';
        case 'Playfair Display': return '"Playfair Display", serif';
        case 'Fira Sans': return '"Fira Sans", sans-serif';
        case 'Oswald': return '"Oswald", sans-serif';
        case 'Lora':
        default:
          return '"Lora", Georgia, serif';
      }
    };

    const isSerif = (fontName) => ['Lora', 'Merriweather', 'EB Garamond', 'PT Serif', 'Playfair Display'].includes(fontName);

    const bodyFont = getFontFamilyCSS(baseFontFamily);
    const nameFont = isSerif(baseFontFamily)
      ? "'Playfair Display', Georgia, serif"
      : bodyFont;
    const headerFont = bodyFont;

    const parseLinkMarkdownHtml = (val, fontFamily) => {
      if (!val) return '';
      const match = val.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (match) {
        const cleanText = match[1].replace(/^https?:\/\/(www\.)?/, '');
        return `<a href="${match[2]}" target="_blank" style="text-decoration:none; color:inherit; font-family:${fontFamily}">${cleanText}</a>`;
      }
      let url = val;
      if (!url.startsWith('http') && (url.includes('.com') || url.includes('.org') || url.includes('.me') || url.includes('.in') || url.includes('github.io'))) {
        url = 'https://' + url;
      }
      const cleanText = val.replace(/^https?:\/\/(www\.)?/, '');
      return `<a href="${url}" target="_blank" style="text-decoration:none; color:inherit; font-family:${fontFamily}">${cleanText}</a>`;
    };

    const fs = baseFontSize;
    const c = resumeData?.contact || {};
    const contactItems = [];
    if (c?.phone) {
      const cleanPhone = c.phone.replace(/[^0-9]/g, '');
      contactItems.push(`
        <a href="https://wa.me/${cleanPhone}" target="_blank" style="text-decoration:none; color:inherit; display:inline-flex; align-items:center; gap:4px; font-family:${headerFont}">
          <svg viewBox="0 0 24 24" width="${fs - 0.5}pt" height="${fs - 0.5}pt" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-right:2px"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
          ${c?.phone}
        </a>
      `);
    }
    if (c?.email) {
      contactItems.push(`
        <a href="mailto:${c.email}" style="text-decoration:none; color:inherit; display:inline-flex; align-items:center; gap:4px; font-family:${headerFont}">
          <svg viewBox="0 0 24 24" width="${fs - 0.5}pt" height="${fs - 0.5}pt" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-right:2px"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
          ${c?.email}
        </a>
      `);
    }
    if (c?.linkedin) {
      contactItems.push(`
        <span style="display:inline-flex; align-items:center; gap:4px; font-family:${headerFont}">
          <svg viewBox="0 0 24 24" width="${fs - 0.5}pt" height="${fs - 0.5}pt" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-right:2px"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path><rect x="2" y="9" width="4" height="12"></rect><circle cx="4" cy="4" r="2"></circle></svg>
          ${parseLinkMarkdownHtml(c?.linkedin, headerFont)}
        </span>
      `);
    }
    if (c?.github) {
      contactItems.push(`
        <span style="display:inline-flex; align-items:center; gap:4px; font-family:${headerFont}">
          <svg viewBox="0 0 24 24" width="${fs - 0.5}pt" height="${fs - 0.5}pt" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-right:2px"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>
          ${parseLinkMarkdownHtml(c?.github, headerFont)}
        </span>
      `);
    }
    if (c?.portfolio) {
      contactItems.push(`
        <span style="display:inline-flex; align-items:center; gap:4px; font-family:${headerFont}">
          <svg viewBox="0 0 24 24" width="${fs - 0.5}pt" height="${fs - 0.5}pt" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-right:2px"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
          ${parseLinkMarkdownHtml(c?.portfolio, headerFont)}
        </span>
      `);
    }

    if (c?.codingprofile) {
      contactItems.push(`
    <span style="display:inline-flex; align-items:center; gap:4px; font-family:${headerFont}">
      <svg 
        viewBox="0 0 24 24" 
        width="${fs - 0.5}pt" 
        height="${fs - 0.5}pt" 
        stroke="currentColor" 
        stroke-width="2" 
        fill="none" 
        stroke-linecap="round" 
        stroke-linejoin="round" 
        style="margin-right:2px"
      >
        <polyline points="16 18 22 12 16 6"></polyline>
        <polyline points="8 6 2 12 8 18"></polyline>
      </svg>

      ${parseLinkMarkdownHtml(c?.codingprofile, headerFont)}
    </span>
  `);
    }

    // 3. Build a self-contained HTML page that mirrors AtsResumePreview
    const sectionRule = (title) => `
      <div style="margin-bottom:2px; margin-top:6px">
        <div style="font-family:${headerFont}; font-weight:bold; font-size:${fs + 0.5}pt;
                    letter-spacing:0.5px; text-transform:uppercase">${title}</div>
        <hr style="border:none; border-top:0.8px solid #111; margin:2px 0 4px 0" />
      </div>`;

    const bulletList = (items) =>
      (items || []).map((b) => `<div style="font-size:${fs - 0.5}pt; padding-left:12px">&bull; ${b}</div>`).join("");

    let body = "";

    // Name
    body += `<div style="text-align:center; margin-bottom:2px">
      <span style="font-size:${fs * 2.1}pt; font-weight:bold;
                   font-family:${nameFont};
                   letter-spacing:1.5px; text-transform:uppercase">${resumeData?.name || ""}</span>
    </div>`;

    // Contact
    if (contactItems.length > 0) {
      body += `<div style="display:flex; justify-content:center; align-items:center; flex-wrap:wrap; gap:6px; font-size:${fs - 0.5}pt;
                           font-family:${headerFont}; color:#444; margin-bottom:8px">
        ${contactItems.join(' <span style="color:#ccc; margin:0 2px">|</span> ')}
      </div>`;
    }

    // Summary
    if (resumeData?.summary) {
      body += sectionRule("Summary");
      body += `<p style="font-size:${fs}pt; margin-bottom:6px; text-align:justify">${resumeData?.summary}</p>`;
    }

    // Skills
    if (resumeData?.skills?.length > 0) {
      body += sectionRule("Technical Skills");
      body += `<div style="margin-bottom:6px">`;
      resumeData.skills.forEach((s) => {
        body += `<div style="font-size:${fs}pt; margin-bottom:2px"><strong>${s?.category || ''}:</strong> ${s?.items || ''}</div>`;
      });
      body += `</div>`;
    }

    // Experience
    if (resumeData?.experience?.length > 0) {
      body += sectionRule("Experience");
      resumeData.experience.forEach((exp) => {
        body += `<div style="margin-bottom:6px">
          <div style="display:flex; justify-content:space-between; font-weight:bold; font-size:${fs}pt">
            <span>${exp?.company || ''}</span>
            <span style="font-weight:normal; font-size:${fs - 0.5}pt">${exp?.dates || ''}</span>
          </div>
          <div style="display:flex; justify-content:space-between; font-style:italic; font-size:${fs - 0.5}pt; margin-bottom:2px">
            <span>${exp?.role || ''}</span><span>${exp?.location || ''}</span>
          </div>
          ${bulletList(exp?.bullets)}
        </div>`;
      });
    }

    // Projects
    if (resumeData?.projects?.length > 0) {
      body += sectionRule("Projects");
      resumeData.projects.forEach((proj) => {
        let nameAndLinks = `<span>${proj?.name || ''}`;
        if (proj?.github) {
          nameAndLinks += ` <span style="font-weight:normal; color:#ccc; margin:0 4px">|</span> <a href="${proj.github}" target="_blank" style="font-weight:normal; font-size:${fs - 0.5}pt; color:#6b21a8; text-decoration:underline">GitHub</a>`;
        }
        if (proj?.liveLink) {
          nameAndLinks += ` <span style="font-weight:normal; color:#ccc; margin:0 4px">|</span> <a href="${proj.liveLink}" target="_blank" style="font-weight:normal; font-size:${fs - 0.5}pt; color:#6b21a8; text-decoration:underline">Live Link</a>`;
        }
        nameAndLinks += `</span>`;

        body += `<div style="margin-bottom:6px">
          <div style="display:flex; justify-content:space-between; font-weight:bold; font-size:${fs}pt; margin-bottom:1px">
            ${nameAndLinks}
            <span style="font-weight:normal; font-size:${fs - 0.5}pt">${proj?.technologies || ''}</span>
          </div>
          ${bulletList(proj?.bullets)}
        </div>`;
      });
    }

    // Achievements
    if (resumeData?.achievements?.length > 0) {
      body += sectionRule("Achievements");
      body += `<div style="margin-bottom:6px">${bulletList(resumeData?.achievements)}</div>`;
    }

    // Education
    if (resumeData?.education?.length > 0) {
      body += sectionRule("Education");

      resumeData.education.forEach((edu) => {
        body += `
      <div style="margin-bottom:4px">

        <div 
          style="
            display:flex;
            justify-content:space-between;
            font-weight:bold;
            font-size:${fs}pt
          "
        >
          <span>${edu?.institution || ''}</span>

          <span 
            style="
              font-weight:normal;
              font-size:${fs - 0.5}pt
            "
          >
            ${edu?.dates || ''}
          </span>
        </div>

        <div 
          style="
            display:flex;
            justify-content:space-between;
            font-style:italic;
            font-size:${fs - 0.5}pt
          "
        >
          <span>${edu?.degree || ''}</span>
          <span>${edu?.location || ''}</span>
        </div>

      </div>
    `;
      });
    }

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Inter:wght@400;500;600;700&family=Lato:ital,wght@0,300;0,400;0,700;1,300;1,400&family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Merriweather:ital,wght@0,300;0,400;0,700;1,300&family=Montserrat:wght@400;500;600;700&family=Open+Sans:wght@400;500;600;700&family=Playfair+Display:wght@700;800&family=Poppins:wght@400;500;600;700&family=Roboto:wght@400;500;700&family=Ubuntu:wght@400;500;700&family=Nunito:wght@400;500;700&family=Raleway:wght@400;500;700&family=PT+Sans:wght@400;700&family=PT+Serif:wght@400;700&family=Fira+Sans:wght@400;500;700&family=Oswald:wght@400;500;700&display=swap" rel="stylesheet" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: ${bodyFont};
      font-size: ${fs}pt;
      line-height: 1.25;
      color: #111;
      background: #fff;
      padding: 36px 48px;
    }
  </style>
</head>
<body>${body}</body>
</html>`;

    // 4. Launch puppeteer-core with system Chrome (fallback for Windows dev)
    const fsLib = require("fs");
    const pathLib = require("path");
    let execPath = null;

    if (process.platform === 'win32') {
      const path1 = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
      const path2 = "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe";
      const path3 = pathLib.join(process.env.USERPROFILE || "", "AppData\\Local\\Google\\Chrome\\Application\\chrome.exe");
      
      if (fsLib.existsSync(path1)) {
        execPath = path1;
      } else if (fsLib.existsSync(path2)) {
        execPath = path2;
      } else if (fsLib.existsSync(path3)) {
        execPath = path3;
      }
    } else {
      execPath = await chromium.executablePath();
    }

    const launchOptions = {
      args: process.platform === 'win32' ? ['--no-sandbox', '--disable-setuid-sandbox'] : chromium.args,
      defaultViewport: process.platform === 'win32' ? null : chromium.defaultViewport,
      executablePath: execPath || undefined,
      headless: process.platform === 'win32' ? true : chromium.headless,
    };

    browser = await puppeteer.launch(launchOptions);

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    // Wait for all web fonts to load completely before generating the PDF
    await page.evaluateHandle('document.fonts.ready');
    await page.emulateMediaType("screen");
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0mm", bottom: "0mm", left: "0mm", right: "0mm" },
    });

    await browser.close();
    browser = null;

    // 5. Send PDF back
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="resume.pdf"`);
    return res.status(200).end(pdfBuffer);

  } catch (error) {
    if (browser) {
      try { await browser.close(); } catch (_) { }
    }
    console.error("PDF generation error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate PDF",
      error: error.message,
    });
  }
};

const updateJdResumeJson = async (req, res) => {
  try {
    const { id } = req.params;
    const { AtsResumeJson } = req.body;

    if (!AtsResumeJson) {
      return res.status(400).json({
        success: false,
        message: "AtsResumeJson is required",
      });
    }

    // Verify it is valid JSON
    try {
      JSON.parse(AtsResumeJson);
    } catch (e) {
      return res.status(400).json({
        success: false,
        message: "Invalid JSON format",
      });
    }

    const jdResume = await JobDescriptionWiseResume.findById(id);
    if (!jdResume) {
      return res.status(404).json({
        success: false,
        message: "Job Description wise resume entry not found",
      });
    }

    jdResume.AtsResumeJson = AtsResumeJson;
    await jdResume.save();

    return res.status(200).json({
      success: true,
      message: "Resume updated successfully",
      data: jdResume,
    });
  } catch (error) {
    console.error("Error updating resume JSON:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

const optimizeJdResumeJson = async (req, res) => {
  try {
    const { id } = req.params;
    const { AtsResumeJson } = req.body;

    if (!AtsResumeJson) {
      return res.status(400).json({
        success: false,
        message: "AtsResumeJson is required",
      });
    }

    // Verify it is valid JSON
    try {
      JSON.parse(AtsResumeJson);
    } catch (e) {
      return res.status(400).json({
        success: false,
        message: "Invalid JSON format",
      });
    }

    const jdResume = await JobDescriptionWiseResume.findById(id);
    if (!jdResume) {
      return res.status(404).json({
        success: false,
        message: "Job Description wise resume entry not found",
      });
    }

    const jobDescText = jdResume.jobDescription.slice(0, 3500);

    const jsonPrompt = `
You are an expert Applicant Tracking System (ATS) optimization specialist and a veteran recruiter. Your task is to optimize the candidate's existing resume JSON so that it aligns COMPLETELY with the target Job Description and Company (if provided). Focus on generating a highly detailed, comprehensive, and keyword-rich resume that passes advanced ATS filters with a near-perfect match rate.

TARGET COMPANY NAME: ${jdResume.companyName || 'Not Specified'}
TARGET JOB DESCRIPTION:
${jobDescText}

INSTRUCTIONS FOR ATS OPTIMIZATION:
1. COMPLETE ALIGNMENT & KEYWORDS:
   - Carefully extract all technical skills, soft skills, domain keywords, tools, frameworks, methodologies, and terminology from the Target Job Description.
   - Infuse these strong keywords naturally but heavily throughout the professional summary, technical skills categories, experience bullet points, and projects.
   - If a Target Company Name is provided, tailor the resume's tone, emphasis, and focus areas to align with the company's industry, culture, tech stack, and goals.

2. DEPTH & DETAIL REQUIREMENT:
   - Ensure the resume is extremely detailed and robust. Avoid high-level summaries or brief bullet points.
   - For every single role in "experience" and project in "projects", expand and rewrite their descriptions to explain what was built, how it was built (technologies, architecture, design decisions), and the value it delivered.
   - Every experience and project MUST have at least 3 to 4 detailed, fully-formed bullet points. Do NOT leave them empty, condensed, or stubbed.

3. REALISTIC & DIGESTIBLE METRICS:
   - Do NOT use exaggerated, implausible, or excessively high-fi metrics (such as "saved $20M in costs" or "improved response times by 99%" on a side project or mid-level job) that would trigger suspicion from a recruiter.
   - Instead, use realistic, believable, and digestible metrics (e.g., "improved query execution times by 15-20%", "achieved 90%+ unit test coverage", "reduced API latency by 120ms", "boosted page load speed by 25%", "successfully managed a repository with 50+ active daily commits"). Keep them grounded, context-appropriate, and professional.

CANDIDATE RESUME (JSON FORMAT):
${AtsResumeJson}

RETURN EXACTLY THIS JSON FORMAT (No extra text, no markdown block formatting, just the raw JSON structure):
{
  "name": "Candidate Full Name",
  "atsScore": 98,
  "contact": {
    "phone": "+91-XXXXXXXXXX",
    "email": "email@example.com",
    "linkedin": "[linkedin.com/in/profile](https://linkedin.com/in/profile)",
    "github": "[github.com/username](https://github.com/username)",
    "portfolio": "https://...",
    "codingprofile": "https://..."
  },
  "summary": "Detailed, high-impact, keyword-rich professional summary mirroring the target JD and aligning with the company.",
  "skills": [
    {
      "category": "Frontend/Backend/Database/DevOps/Languages etc.",
      "items": "React.js, Redux, and other key target skills extracted from the JD"
    }
  ],
  "experience": [
    {
      "company": "Company Name",
      "location": "Location",
      "role": "Role Title",
      "dates": "Month Year - Month Year",
      "bullets": [
        "First highly detailed, ATS-keyword-optimized bullet point aligned with the target JD and company using a realistic, digestible metric.",
        "Second detailed bullet point detailing technologies, design decisions, and real-world responsibilities.",
        "Third detailed bullet point explaining problem-solving and collaboration details.",
        "Fourth detailed bullet point demonstrating impact using digestible, believable metrics."
      ]
    }
  ],
  "projects": [
    {
      "name": "Project Name",
      "technologies": "React, Node.js, MongoDB, TailwindCSS, etc.",
      "github": "https://github.com/...",
      "liveLink": "https://...",
      "bullets": [
        "First detailed project bullet explaining the architecture, core feature engineered, and the problem solved using JD-specific keywords.",
        "Second detailed project bullet outlining technologies, APIs, database integration, or state management details.",
        "Third detailed project bullet describing optimization, testing, deployment, and a digestible metric of success.",
        "Fourth detailed project bullet (highly recommended for depth) demonstrating specific implementation challenges overcome."
      ]
    }
  ],
  "achievements": [
    "Achievement text aligned with industry success and target keywords"
  ],
  "education": [
    {
      "institution": "University Name",
      "location": "City",
      "degree": "Degree Name | CGPA: X.X or Percentage",
      "dates": "Month Year - Month Year"
    }
  ]
}
`;

    const rawJson = await aiApi(jsonPrompt);
    const resumeData = parseGeminiJSON(rawJson);

    const estimatedScore = resumeData.atsScore ?? 95;
    delete resumeData.atsScore;

    jdResume.AtsResumeJson = JSON.stringify(resumeData, null, 2);
    jdResume.ATSScoreOfResume = estimatedScore;

    await jdResume.save();

    return res.status(200).json({
      success: true,
      message: "Tailored ATS Resume optimized successfully",
      data: jdResume,
    });
  } catch (error) {
    console.error("Error optimizing ATS resume JSON:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during ATS resume optimization",
      error: error.message,
    });
  }
};


module.exports = {
  register,
  login,
  logout,
  updateProfile,
  applyJobs,
  bookmark,
  getNotifications,
  remember,
  deleteResume,
  uploadResume,
  createInterviewPrep,
  getInterviewPrep,
  deleteInterviewPrep,
  generateMoreQuestions,
  createJdResume,
  getJdResumes,
  getJdResumeById,
  deleteJdResume,
  analyzeExistingResumeForJd,
  generateAtsResume,
  generateResumePdf,
  updateJdResumeJson,
  optimizeJdResumeJson
};