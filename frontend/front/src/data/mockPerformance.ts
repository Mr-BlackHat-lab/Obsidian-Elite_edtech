import { PerformanceData } from "../lib/api";

export const FAKE_PERFORMANCE_DATA: PerformanceData = {
  currentScore: 85,
  history: [
    {
      id: "fake-1",
      userId: "user-1",
      score: 10,
      correct: 1,
      incorrect: 0,
      recordedAt: new Date(Date.now() - 500000).toISOString(),
    },
    {
      id: "fake-2",
      userId: "user-1",
      score: 20,
      correct: 2,
      incorrect: 0,
      recordedAt: new Date(Date.now() - 400000).toISOString(),
    },
    {
      id: "fake-3",
      userId: "user-1",
      score: 15,
      correct: 2,
      incorrect: 1,
      recordedAt: new Date(Date.now() - 300000).toISOString(),
    },
    {
      id: "fake-4",
      userId: "user-1",
      score: 45,
      correct: 5,
      incorrect: 1,
      recordedAt: new Date(Date.now() - 200000).toISOString(),
    },
    {
      id: "fake-5",
      userId: "user-1",
      score: 85,
      correct: 9,
      incorrect: 1,
      recordedAt: new Date(Date.now() - 100000).toISOString(),
    },
  ],
};
