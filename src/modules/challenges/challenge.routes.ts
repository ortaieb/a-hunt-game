import { Router, Request, Response } from 'express';
import { challengeService } from './challenge.service';
import { authenticateToken, requireRole } from '../../shared/middleware/auth';
import { asyncHandler } from '../../shared/middleware/asyncHandler';
import { validate } from '../../shared/middleware/validation';
import { challengeParticipantsSchema, createChallengeSchema } from './challenge.validator';
import { NotFoundError } from '../../shared/types/errors';

const router = Router();

// List challenges
router.get(
  '/',
  authenticateToken,
  requireRole('game.admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const challenges = await challengeService.activeChallenges();
    res.json(challenges);
  }),
);

// find specific challenge
router.get(
  '/:challengeId',
  authenticateToken,
  requireRole('game.admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const challenge = await challengeService.getChallenge(req.params.challengeId);
    res.json(challenge);
  }),
);

// Create new challenge
router.post(
  '/',
  authenticateToken,
  requireRole('game.admin'),
  validate(createChallengeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const challenge = await challengeService.createChallenge(req.body);
    res.status(201).json(challenge);
  }),
);

// Update existing challenge
router.post(
  '/:challengeId',
  authenticateToken,
  requireRole('game.admin'),
  validate(createChallengeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const challenge = await challengeService.updateChallenge(req.params.challengeId, req.body);
    res.json(challenge);
  }),
);

router.get(
  '/:challengeId/participants',
  authenticateToken,
  requireRole('game.admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const challenge = await challengeService.getParticipantsByChallengeId(req.params.challengeId);
    res.json(challenge);
  }),
);

router.get(
  '/:challengeId/participants/:participantId',
  authenticateToken,
  requireRole('game.admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const challenge = await challengeService.getParticipant(req.params.participantId);
    if (challenge != undefined && challenge.challenge_id != req.params.challengeId) {
      throw new NotFoundError(
        `Could not find participant ${req.params.participantId} in challenge ${req.params.challengeId}`,
      );
    }

    res.json(challenge);
  }),
);

router.get(
  '/:challengeId/participants/byUser/:username',
  authenticateToken,
  requireRole('game.admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const challenges = await challengeService.getParticipantByChallengeAndUsername(
      req.params.challengeId,
      req.params.username,
    );
    res.json(challenges);
  }),
);

router.post(
  '/:challengeId/inviteParticipants',
  authenticateToken,
  requireRole('game.admin'),
  validate(challengeParticipantsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const invited = await challengeService.inviteParticipants(req.body);
    res.json(invited);
  }),
);

export default router;
