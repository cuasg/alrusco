import { Router } from "express";

const router = Router();

router.get("/profile", (_req, res) => {
  res.json({
    name: "Your Name",
    tagline: "Engineer · Builder · Homelab Enthusiast",
  });
});

export default router;

