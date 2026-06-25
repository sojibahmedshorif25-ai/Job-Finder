/* global process */
import { connectDB, client } from "./db.js";
import bcrypt from "bcryptjs";

async function seed() {
  console.log("Starting database seed...");
  const { db } = await connectDB();

  // Clear existing collections
  await db.collection("users").deleteMany({});
  await db.collection("user").deleteMany({});
  await db.collection("account").deleteMany({});
  await db.collection("verification").deleteMany({});
  await db.collection("session").deleteMany({});
  await db.collection("startups").deleteMany({});
  await db.collection("opportunities").deleteMany({});
  await db.collection("applications").deleteMany({});
  await db.collection("payments").deleteMany({});

  const hashPassword = async (password) => {
    const salt = await bcrypt.genSalt(12);
    return await bcrypt.hash(password, salt);
  };

  const adminHash = await hashPassword("AdminPassword123!");
  const founderHash = await hashPassword("FounderPassword123!");
  const collabHash = await hashPassword("CollabPassword123!");

  const now = new Date();

  const userSeeds = [
    { name: "Platform Admin",  email: "admin@startupforge.com",    image: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150", hash: adminHash,  role: "Admin" },
    { name: "Elon Musk",       email: "founder1@tesla.com",        image: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=150", hash: founderHash, role: "Founder" },
    { name: "Jane Doe",        email: "founder2@startup.com",      image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150", hash: founderHash, role: "Founder" },
    { name: "Alex Smith",      email: "collab1@gmail.com",         image: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=150", hash: collabHash,  role: "Collaborator", skills: ["React", "Node.js", "Tailwind CSS", "JavaScript"], bio: "Full Stack Engineer passionate about building next-gen web applications." },
    { name: "Sarah Connor",    email: "collab2@gmail.com",         image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=150", hash: collabHash,  role: "Collaborator", skills: ["Figma", "UI/UX Design", "Wireframing", "Prototyping"], bio: "Product designer with 3 years of experience in mobile and web platforms." }
  ];

  // 1. Seed Users — custom auth only (Better Auth users are created via registration)
  const usersCollection = [];

  for (const s of userSeeds) {
    usersCollection.push({
      name: s.name,
      email: s.email,
      image: s.image,
      password: s.hash,
      role: s.role,
      isBlocked: false,
      skills: s.skills || [],
      bio: s.bio || "",
      createdAt: now,
      updatedAt: now
    });
  }

  await db.collection("users").insertMany(usersCollection);
  console.log("Seeded 5 users successfully (custom auth).");

  // 2. Seed Startups
  const startups = [
    {
      startup_name: "SpaceX Gen",
      logo: "https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?auto=format&fit=crop&w=200",
      industry: "Aerospace",
      description: "Developing reusable orbital rockets to enable humans to become a multi-planetary species.",
      funding_stage: "Series C",
      team_size: 12,
      founder_email: "founder1@tesla.com",
      status: "Approved",
      createdAt: new Date()
    },
    {
      startup_name: "HealthFlow AI",
      logo: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=200",
      industry: "Healthcare",
      description: "Leveraging machine learning to predict and optimize patient flow in regional hospitals.",
      funding_stage: "Seed",
      team_size: 5,
      founder_email: "founder2@startup.com",
      status: "Pending",
      createdAt: new Date()
    }
  ];

  const startupResults = await db.collection("startups").insertMany(startups);
  console.log("Seeded 2 startups successfully.");

  const spacexId = startupResults.insertedIds[0];
  const healthflowId = startupResults.insertedIds[1];

  // 3. Seed Opportunities
  const opportunities = [
    {
      startup_id: spacexId,
      startup_name: "SpaceX Gen",
      founder_email: "founder1@tesla.com",
      industry: "Aerospace",
      role_title: "Rocket Guidance Systems Engineer",
      required_skills: ["C++", "Rust", "Control Theory", "Embedded Systems"],
      work_type: "On-site",
      commitment_level: "Full-time",
      deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      createdAt: new Date()
    },
    {
      startup_id: spacexId,
      startup_name: "SpaceX Gen",
      founder_email: "founder1@tesla.com",
      industry: "Aerospace",
      role_title: "React Web Developer (Mission Control)",
      required_skills: ["React", "JavaScript", "D3.js", "Tailwind CSS"],
      work_type: "Remote",
      commitment_level: "Full-time",
      deadline: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days from now
      createdAt: new Date()
    },
    {
      startup_id: healthflowId,
      startup_name: "HealthFlow AI",
      founder_email: "founder2@startup.com",
      industry: "Healthcare",
      role_title: "Python Data Scientist",
      required_skills: ["Python", "PyTorch", "Pandas", "Healthcare Data"],
      work_type: "Hybrid",
      commitment_level: "Part-time",
      deadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days from now
      createdAt: new Date()
    }
  ];

  await db.collection("opportunities").insertMany(opportunities);
  console.log("Seeded 3 opportunities successfully.");

  console.log("Database seeding completed successfully.");
  await client.close();
}

seed().catch(err => {
  console.error("Seeding error:", err);
  process.exit(1);
});
