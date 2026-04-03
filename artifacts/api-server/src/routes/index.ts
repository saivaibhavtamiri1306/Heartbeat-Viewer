import { Router, type IRouter } from "express";
import healthRouter from "./health";
import ttsRouter from "./tts";
import followupRouter from "./followup";
import transcribeRouter from "./transcribe";

const router: IRouter = Router();

router.use(healthRouter);
router.use(ttsRouter);
router.use(followupRouter);
router.use(transcribeRouter);

export default router;
