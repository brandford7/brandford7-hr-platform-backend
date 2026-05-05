import { Router } from 'express';
import { prisma } from '../config/prisma';
import { validate } from '../middleware/validate.middleware';
import { authenticate, requirePasswordChanged, requirePrivilege } from '../middleware/auth.middleware';
import { leaveTypeSchema } from '../schemas/leave.schemas';
import { idParamSchema } from '../schemas/employee.schemas';
import { sendSuccess, sendCreated } from '../utils/response.util';
import { NotFoundError } from '../errors/notFound.error';

const router = Router();

router.use(authenticate, requirePasswordChanged);

router.get('/', async (_req, res) => {
  const types = await prisma.leaveType.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });
  sendSuccess(res, types);
});

router.post(
  '/',
  requirePrivilege('LeaveTypeCreate'),
  validate({ body: leaveTypeSchema }),
  async (req, res) => {
    const lt = await prisma.leaveType.create({ data: req.body });
    sendCreated(res, lt, 'Leave type created');
  },
);

router.patch(
  '/:id',
  requirePrivilege('LeaveTypeEdit'),
  validate({ params: idParamSchema, body: leaveTypeSchema.partial() }),
  async (req, res) => {
    const existing = await prisma.leaveType.findUnique({ where: { id: req.params.id! as string } });
    if (!existing) throw new NotFoundError('Leave type');
    const lt = await prisma.leaveType.update({ where: { id: req.params.id! as string }, data: req.body });
    sendSuccess(res, lt, 'Leave type updated');
  },
);

router.delete(
  '/:id',
  requirePrivilege('LeaveTypeDelete'),
  validate({ params: idParamSchema }),
  async (req, res) => {
    await prisma.leaveType.update({ where: { id: req.params.id! as string }, data: { isActive: false } });
    sendSuccess(res, null, 'Leave type deactivated');
  },
);

export default router;