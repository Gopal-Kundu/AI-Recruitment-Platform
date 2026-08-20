const Company = require("../models/company.model");
const Job = require("../models/job.model");
const Notification = require("../models/notification.model");
const User = require("../models/user.model");
const { aiApi, parseGeminiJSON } = require("./ai.controller");
const { extractText, getDocumentProxy } = require('unpdf');
const { upsertJobToPinecone, upsertManyJobsToPinecone, queryMatchingJobs, deleteJobFromPinecone, formatJobText } = require("../utils/pinecone");
const { generateEmbedding } = require("../Ai/gemini");

// Helper to fetch and extract text from a PDF URL
const extractTextFromPdf = async (url) => {
  const buffer = await fetch(url)
  .then(res => res.arrayBuffer())
  const pdf = await getDocumentProxy(new Uint8Array(buffer))
  const { text } = await extractText(pdf, { mergePages: true })
  return text;
};

const postJob = async (req, res) => {
  try {
    const {
      title,
      description,
      requirements,
      salary,
      location,
      jobType,
      experience,
      company,
      vacancy,
    } = req.body;
    const userId = req.id;
    if (!userId) {
      return res.status(400).json({
        message: "Unauthenticated user",
        success: false,
      });
    }
    const companyData = await Company.findOne({
      name: { $regex: `^${company}$`, $options: "i" },
    });

    const job = await Job.create({
      title,
      description,
      requirements,
      salary,
      location,
      jobType,
      experience,
      vacancy,
      company,
      logo:
        companyData?.logo ||
        "https://media.wired.com/photos/65e88c25b8b2544099643d3d/master/w_1600,c_limit/aaaoriginal.jpg",
      createdBy: userId,
      applications: [],
    });

    try {
      await upsertJobToPinecone(job);
    } catch (pineconeErr) {
      console.error("Failed to upsert job to Pinecone database:", pineconeErr.message);
    }

    const user = await User.findById(userId);
    if (user) {
      if (!user.postedJobs) user.postedJobs = [];
      user.postedJobs.push(job._id);
      await user.save();
      await user.populate("postedJobs");
      await user.populate("appliedJobs");
      await user.populate("savedJobs");
      await user.populate("createdCompanies");
      user.password = undefined;
    }
    return res.status(201).json({
      message: "Job posted successfully",
      success: true,
      job,
      user,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Server error",
      success: false,
    });
  }
};

const getAllJobs = async (req, res) => {
  try {
    const { keyword } = req.query;

    const query = keyword
      ? {
        $or: [
          { title: { $regex: keyword, $options: "i" } },
          { description: { $regex: keyword, $options: "i" } },
        ],
      }
      : {};

    const jobs = await Job.find(query);

    res.status(200).json({
      success: true,
      count: jobs.length,
      jobs,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getTrendingJobs = async (req, res) => {
  try {
    const jobs = await Job.find({}).sort({ salary: -1 }).limit(8);

    res.status(200).json({
      success: true,
      jobs,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const deleteJobById = async (req, res) => {
  try {
    const userId = req.id;
    const jobId = req.params.id;
    await Job.findByIdAndDelete(jobId);

    // Sync deletion to Pinecone DB
    try {
      await deleteJobFromPinecone(jobId);
    } catch (pineconeErr) {
      console.error("Failed to delete job from Pinecone during deletion:", pineconeErr.message);
    }

    await User.updateOne({ _id: userId }, { $pull: { postedJobs: jobId } });

    await User.updateMany(
      { savedJobs: jobId },
      { $pull: { savedJobs: jobId } }
    );

    await User.updateMany(
      { appliedJobs: jobId },
      { $pull: { appliedJobs: jobId } }
    );

    return res.status(200).json({
      message: "Job Deleted Successfully",
      success: true,
    });
  } catch (err) {
    return res.status(400).json({
      message: "Failed to delete Job",
      success: false,
    });
  }
};

const getJobById = async (req, res) => {
  try {
    const { id } = req.params;
    const job = await Job.find({ _id: id });

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    res.status(200).json({
      success: true,
      job,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getApplicants = async (req, res) => {
  try {
    const jobId = req.params.id;
    const job = await Job.findById(jobId).populate("applications");

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Applications fetched...",
      applicants: job.applications,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

const searchJobs = async (req, res) => {
  const { query, pageno, page } = req.query;
  if (!query || query.trim() === "") {
    return res.status(200).json({
      success: true,
      countJobs: 0,
      jobs: [],
    });
  }
  const currentPage = parseInt(pageno || page) || 1;
  const limit = 8;

  try {
    const filterCriteria = {
      $or: [
        { title: { $regex: query, $options: "i" } },
        { company: { $regex: query, $options: "i" } },
        { location: { $regex: query, $options: "i" } },
        { role: { $regex: query, $options: "i" } },
        { requirement: { $regex: query, $options: "i" } },
        { description: { $regex: query, $options: "i" } },
      ],
    };

    const countJobs = await Job.countDocuments(filterCriteria);
    const jobs = await Job.find(filterCriteria)
      .sort({ createdAt: -1 })
      .skip((currentPage - 1) * limit)
      .limit(limit);

    res.status(200).json({
      success: true,
      countJobs,
      jobs,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

const approve = async (req, res) => {
  try {
    const jobId = req.params.id;
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    job.rejectedApplicant = (job.rejectedApplicant || []).filter(
      (userId) => userId && userId.toString() !== id
    );

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!job.approvedApplicant) job.approvedApplicant = [];
    if (!job.approvedApplicant.includes(id)) {
      job.approvedApplicant.push(id);
      await job.save();

      user.rejectedJobs = (user.rejectedJobs || []).filter(
        (jobIds) => jobIds && jobIds.toString() !== jobId
      );

      if (!user.approvedJobs) user.approvedJobs = [];
      if (!user.approvedJobs.includes(jobId)) {
        user.approvedJobs.push(jobId);
      }

      await user.save();
    }

    //Send Notification to User.
    let notificationSchemaId = user?.notifications;
    let notificationSchema = notificationSchemaId ? await Notification.findById(notificationSchemaId) : null;

    if (!notificationSchema) {
      const newNotification = await Notification.create({
        allMessages: [{
          message: `${job?.company || ''} accepted your application for role ${job?.title || ''}`,
          time: new Date(),
          companyLogo: job?.logo || '',
        }],
        newMessageCount: 1,
      })
      user.notifications = newNotification._id;
      await user.save();
      await newNotification.save();
    } else {
      if (!notificationSchema.allMessages) notificationSchema.allMessages = [];
      notificationSchema.allMessages.push({
        message: `${job?.company || ''} accepted your application for role ${job?.title || ''}`,
        time: new Date(),
        companyLogo: job?.logo || '',
      });

      notificationSchema.newMessageCount = (notificationSchema.newMessageCount || 0) + 1;
      await notificationSchema.save();
    }

    return res.status(200).json({
      success: true,
      message: "User approved successfully",
      approvedApplicant: job.approvedApplicant,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

const reject = async (req, res) => {
  try {
    const jobId = req.params.id;
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    job.approvedApplicant = (job.approvedApplicant || []).filter(
      (userId) => userId && userId.toString() !== id
    );
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!job.rejectedApplicant) job.rejectedApplicant = [];
    if (!job.rejectedApplicant.includes(id)) {
      job.rejectedApplicant.push(id);
      await job.save();

      user.approvedJobs = (user.approvedJobs || []).filter(
        (jobIds) => jobIds && jobIds.toString() !== jobId
      );
      if (!user.rejectedJobs) user.rejectedJobs = [];
      user.rejectedJobs.push(jobId);
      await user.save();
    }

    //Send Notification to User.
    let notificationSchemaId = user?.notifications;
    let notificationSchema = notificationSchemaId ? await Notification.findById(notificationSchemaId) : null;

    if (!notificationSchema) {
      const newNotification = await Notification.create({
        allMessages: [{
          message: `${job?.company || ''} rejected your application for role ${job?.title || ''}`,
          time: new Date(),
          companyLogo: job?.logo || '',
        }],
        newMessageCount: 1,
      })
      user.notifications = newNotification._id;
      await user.save();
      await newNotification.save();
    } else {
      if (!notificationSchema.allMessages) notificationSchema.allMessages = [];
      notificationSchema.allMessages.push({
        message: `${job?.company || ''} rejected your application for role ${job?.title || ''}`,
        time: new Date(),
        companyLogo: job?.logo || '',
      });

      notificationSchema.newMessageCount = (notificationSchema.newMessageCount || 0) + 1;
      await notificationSchema.save();
    }

    return res.status(200).json({
      success: true,
      message: "User rejected successfully",
      rejectedApplicant: job.rejectedApplicant,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

const applyFilter = async (req, res) => {
  try {
    const { pageno } = req.params;
    const { salaryRange, vacancyRange, jobType, location, salarySort } = req.body;

    let query = {};
    let sort = {};

    if (jobType) {
      query.jobType = { $regex: jobType, $options: "i" };
    }

    if (location) {
      query.location = { $regex: location, $options: "i" };
    }

    if (vacancyRange !== undefined && vacancyRange !== null) {
      query.vacancy = { $lte: Number(vacancyRange) };
    }

    if (salaryRange !== undefined && salaryRange !== null) {
      query.salary = { $lte: Number(salaryRange) };
    }

    if (salarySort === "low-high") sort.salary = 1;
    if (salarySort === "high-low") sort.salary = -1;

    const countJobs = await Job.find(query).countDocuments();
    const jobs = await Job.find(query)
      .sort(sort)
      .skip((pageno - 1) * 8)
      .limit(8).sort({createdAt: -1});

    return res.status(200).json({
      countJobs,
      success: true,
      jobs,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

const getMatchPercentage = async (req, res) => {
  try {
    const { skills, resumeLink, description, requirements } = req.body;

    if (!skills && !resumeLink) {
      return res.status(200).json("");
    }

    let resumeText = "";
    if (resumeLink) {
      resumeText = await extractTextFromPdf(resumeLink);
    }

    const prompt = `
User Resume Text (extracted from PDF):
${resumeText || "No resume text could be extracted or no resume link provided."}

User Skills: ${skills || ""}

Job Description:
${description || ""}

Job Requirements:
${requirements || ""}

Task:
- Compare user profile with job
- Give match percentage (0–100)
- Be strict

Return ONLY JSON:
{ "matchPercentage": 85 }
`;

    try {
      const aiRes = await aiApi(prompt);
      const parsed = parseGeminiJSON(aiRes);

      return res.status(200).json(parsed?.matchPercentage || "");
    } catch (err) {
      return res.status(200).json("");
    }

  } catch (error) {
    return res.status(200).json("");
  }
};


const getJobsByAiTitles = async (req, res) => {
  try {
    const userId = req.id;
    let { skills, resumeLink, refresh } = req.body;

    const user = await User.findById(userId).populate("recomend");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // If recomend field has jobs and we are not refreshing, return saved jobs immediately (limited to 15)
    if (!refresh && user?.recomend && user?.recomend?.length > 0) {
      return res.status(200).json({ success: true, jobs: user.recomend.slice(0, 15) });
    }

    if (!skills) {
      skills = user?.profile?.skills || "";
    }
    if (!resumeLink) {
      resumeLink = user?.profile?.resume || "";
    }

    if (!skills && !resumeLink) {
      return res.status(400).json({ success: false, jobs: [], message: "Skills or resume link not found in profile or request body." });
    }

    let resumeText = "";
    if (resumeLink) {
      resumeText = await extractTextFromPdf(resumeLink);
    }

    // Attempt Pinecone matching first
    try {
      const userProfileText = `User Skills: ${skills || ""}
User Resume Text: ${resumeText || ""}`;

      const queryEmbedding = await generateEmbedding(userProfileText);
      const matchedIds = await queryMatchingJobs(queryEmbedding, 15);

      if (matchedIds && matchedIds.length > 0) {
        const jobs = await Job.find({ _id: { $in: matchedIds } });
        // Sort the jobs to maintain the Pinecone relevance ordering
        const jobMap = new Map(jobs.map(job => [job?._id?.toString() || '', job]));
        const orderedJobs = matchedIds
          .map(id => jobMap.get(id))
          .filter(Boolean);

        user.recomend = orderedJobs.map(job => job?._id).slice(0, 15);
        await user.save();

        const updatedUser = await User.findById(userId).populate("recomend");
        return res.status(200).json({ success: true, jobs: (updatedUser?.recomend || []).slice(0, 15) });
      }
    } catch (pineconeErr) {
      console.error("Pinecone recommendation failed, falling back to Gemini text keywords:", pineconeErr.message);
    }

    // Fallback: Gemini text keyword matching
    const prompt = `
User Skills: ${skills || ""}
User Resume Text (extracted from PDF):
${resumeText || ""}

Task:
- Analyze the user's skills and resume text.
- Generate all possible relevant job title keywords, target roles, or positions (e.g. "Frontend Developer", "MERN Stack Developer", "Software Engineer", "React Developer") that perfectly match this user profile.
- Return ONLY a JSON array of these job title keywords, for example: ["Frontend Developer", "MERN Stack Developer", "React Developer", "Software Engineer"]
`;

    let aiResponse;
    try {
      aiResponse = await aiApi(prompt);
      const jobTitles = parseGeminiJSON(aiResponse);

      if (!Array.isArray(jobTitles) || jobTitles.length === 0) {
        return res.status(200).json({ success: true, jobs: [] });
      }

      // Keyword/partial matching using regex on job titles (limited to 15)
      const regexQueries = jobTitles.map(title => ({
        title: { $regex: title, $options: "i" }
      }));

      const jobs = await Job.find({ $or: regexQueries }).limit(15);

      if (jobs && jobs.length > 0) {
        const jobIds = jobs.map(job => job?._id).slice(0, 15);

        user.recomend = jobIds;
        await user.save();

        const updatedUser = await User.findById(userId).populate("recomend");
        return res.status(200).json({ success: true, jobs: (updatedUser?.recomend || []).slice(0, 15) });
      }

      return res.status(200).json({ success: true, jobs: [] });
    } catch (err) {
      console.error("AI or DB search failed:", err.message);
      return res.status(200).json({ success: true, jobs: [] });
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const syncAllJobsToPinecone = async (req, res) => {
  try {
    const jobs = await Job.find({});
    if (!jobs || jobs.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No jobs found in the database to sync.",
        successCount: 0
      });
    }

    // Format all jobs to text strings
    const texts = jobs.map(job => formatJobText(job));
    console.log(texts.length);
    // 1-time Gemini embedding call with the array of texts
    const embeddings = await generateEmbedding(texts);
    console.log(embeddings.length);
    // Batch upsert matching each job with its corresponding embedding vector
    await upsertManyJobsToPinecone(jobs, embeddings);
    console.log(3);
    return res.status(200).json({
      success: true,
      message: `Successfully synchronized all ${jobs.length} jobs to Pinecone.`,
      successCount: jobs.length
    });
  } catch (error) {
    console.error("Sync error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Sync failed",
      error: error.message
    });
  }
};


module.exports = {
  postJob,
  getAllJobs,
  getApplicants,
  getJobById,
  deleteJobById,
  searchJobs,
  approve,
  reject,
  getMatchPercentage,
  applyFilter,
  getJobsByAiTitles,
  getTrendingJobs,
  syncAllJobsToPinecone,
};
