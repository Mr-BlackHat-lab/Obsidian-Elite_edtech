import { Request, Response, NextFunction } from "express";
import { prisma } from "../../db/prisma";

export async function getPerformance(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = req.auth?.userId;
  if (!userId) {
    res.status(401).json({ message: "Unauthorized", data: null });
    return;
  }

  try {
    const history = await prisma.performanceRecord.findMany({
      where: { userId },
      orderBy: { recordedAt: "asc" },
    });

    if (!history.length) {
      // Seed with initial record if empty
      const init = await prisma.performanceRecord.create({
        data: { userId, score: 0, correct: 0, incorrect: 0 },
      });
      res.json({ message: "Success", data: { history: [init], currentScore: 0 } });
      return;
    }

    const currentScore = history[history.length - 1]?.score ?? 0;
    res.json({ message: "Success", data: { history, currentScore } });
  } catch (err) {
    next(err);
  }
}

export async function addPerformanceResult(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = req.auth?.userId;
  const { isCorrect } = req.body;

  if (!userId) {
    res.status(401).json({ message: "Unauthorized", data: null });
    return;
  }

  try {
    const latest = await prisma.performanceRecord.findFirst({
      where: { userId },
      orderBy: { recordedAt: "desc" },
    });

    const scoreChange = isCorrect ? 10 : -5;
    const newScore = Math.max(0, (latest?.score ?? 0) + scoreChange);
    const newCorrect = (latest?.correct ?? 0) + (isCorrect ? 1 : 0);
    const newIncorrect = (latest?.incorrect ?? 0) + (isCorrect ? 0 : 1);

    const record = await prisma.performanceRecord.create({
      data: {
        userId,
        score: newScore,
        correct: newCorrect,
        incorrect: newIncorrect,
      },
    });

    const fullHistory = await prisma.performanceRecord.findMany({
      where: { userId },
      orderBy: { recordedAt: "asc" },
    });

    res.json({ message: "Success", data: { history: fullHistory, currentScore: record.score } });
  } catch (err) {
    next(err);
  }
}
