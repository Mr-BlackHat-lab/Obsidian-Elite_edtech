db = db.getSiblingDB("learnpulse");

db.users.updateOne(
  { user_id: "cli_user" },
  {
    $set: {
      user_id: "cli_user",
      username: "cli_user",
      email: "cli_user@example.com",
      total_sessions: 1,
      overall_score: 0.67,
    },
  },
  { upsert: true },
);

db.sessions.updateOne(
  { session_id: "demo-session" },
  {
    $set: {
      session_id: "demo-session",
      user_id: "cli_user",
      video_url: "https://www.youtube.com/watch?v=demo",
      transcript:
        "Docker volumes persist data. Kubernetes orchestrates containers.",
      concepts: ["Docker fundamentals", "Kubernetes basics"],
      questions: [
        {
          question_id: "q1",
          question: "What is the purpose of a Docker volume?",
          type: "mcq",
          difficulty: "medium",
          options: [
            "To speed up image builds",
            "To persist data outside container lifecycle",
            "To expose container ports",
            "To link multiple containers",
          ],
          answer: "B",
          explanation:
            "Volumes persist data independently from container lifecycle.",
          concept_tag: "Docker fundamentals",
        },
        {
          question_id: "q2",
          question: "What does Kubernetes orchestrate?",
          type: "mcq",
          difficulty: "easy",
          options: [
            "Word documents",
            "Containers and services",
            "Physical servers only",
            "Database backups",
          ],
          answer: "B",
          explanation:
            "Kubernetes orchestrates containerized workloads and services.",
          concept_tag: "Kubernetes basics",
        },
        {
          question_id: "q3",
          question: "Which Docker feature persists data beyond container life?",
          type: "mcq",
          difficulty: "easy",
          options: ["Images", "Volumes", "Ports", "Networks"],
          answer: "B",
          explanation:
            "Volumes are used to persist and share data outside the container lifecycle.",
          concept_tag: "Docker fundamentals",
        },
      ],
      attempts: [
        {
          question_id: "q1",
          user_answer: "A",
          correct: false,
          concept_tag: "Docker fundamentals",
          timestamp: new Date(),
        },
        {
          question_id: "q2",
          user_answer: "B",
          correct: true,
          concept_tag: "Kubernetes basics",
          timestamp: new Date(),
        },
        {
          question_id: "q3",
          user_answer: "A",
          correct: false,
          concept_tag: "Docker fundamentals",
          timestamp: new Date(),
        },
      ],
      score: 0.3333,
      weak_topics: ["Docker fundamentals"],
      source: "recorded",
      status: "ready",
    },
  },
  { upsert: true },
);
