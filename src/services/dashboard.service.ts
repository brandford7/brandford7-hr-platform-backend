import { prisma } from "../config/prisma";

export async function getDashboardStats() {
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const today = new Date(now.toDateString());

  const [
    totalEmployees,
    activeEmployees,
    totalDepartments,
    pendingLeave,
    newHiresThisMonth,
    newHiresLastMonth,
    leaveByStatus,
    todayAttendance,
    employeesByDepartment,
    employeesByStatus,
    recentLeaveRequests,
    upcomingBirthdays,
  ] = await prisma.$transaction([
    prisma.employee.count({ where: { deletedAt: null } }),
    prisma.employee.count({ where: { deletedAt: null, status: "ACTIVE" } }),
    prisma.department.count({ where: { deletedAt: null } }),
    prisma.leaveRequest.count({ where: { status: "PENDING" } }),
    prisma.employee.count({
      where: { deletedAt: null, hireDate: { gte: thisMonthStart } },
    }),
    prisma.employee.count({
      where: {
        deletedAt: null,
        hireDate: { gte: lastMonthStart, lt: thisMonthStart },
      },
    }),
    prisma.leaveRequest.groupBy({ by: ["status"], _count: { id: true } }),
    prisma.attendance.count({ where: { date: today } }),
    prisma.department.findMany({
      where: { deletedAt: null },
      select: {
        name: true,
        _count: {
          select: {
            employees: { where: { deletedAt: null, status: "ACTIVE" } },
          },
        },
      },
      orderBy: { employees: { _count: "desc" } },
      take: 8,
    }),
    prisma.employee.groupBy({
      by: ["status"],
      where: { deletedAt: null },
      _count: { id: true },
    }),
    prisma.leaveRequest.findMany({
      where: { status: "PENDING" },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        totalDays: true,
        status: true,
        createdAt: true,
        employee: {
          select: { firstName: true, lastName: true, avatarUrl: true },
        },
        leaveType: { select: { name: true, colorHex: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.$queryRaw<
      Array<{
        id: string;
        firstName: string;
        lastName: string;
        dateOfBirth: Date;
        avatarUrl: string | null;
      }>
    >`
      SELECT id,
             first_name AS "firstName",
             last_name  AS "lastName",
             date_of_birth AS "dateOfBirth",
             avatar_url AS "avatarUrl"
      FROM employees
      WHERE deleted_at IS NULL
        AND date_of_birth IS NOT NULL
        AND (
          DATE_PART('month', date_of_birth) > DATE_PART('month', NOW())
          OR (
            DATE_PART('month', date_of_birth) = DATE_PART('month', NOW())
            AND DATE_PART('day', date_of_birth) >= DATE_PART('day', NOW())
          )
        )
      ORDER BY DATE_PART('month', date_of_birth), DATE_PART('day', date_of_birth)
      LIMIT 5
    `,
  ]);

  const newHiresTrend =
    newHiresLastMonth > 0
      ? Math.round(
          ((newHiresThisMonth - newHiresLastMonth) / newHiresLastMonth) * 100,
        )
      : 0;

  return {
    overview: {
      totalEmployees,
      activeEmployees,
      totalDepartments,
      pendingLeave,
      newHiresThisMonth,
      newHiresTrend,
      todayAttendance,
    },
    leaveByStatus: leaveByStatus.map((l) => ({
      status: l.status,
      count: l._count.id,
    })),
    employeesByDepartment: employeesByDepartment.map((d) => ({
      name: d.name,
      count: d._count.employees,
    })),
    employeesByStatus: employeesByStatus.map((e) => ({
      status: e.status,
      count: e._count.id,
    })),
    recentLeaveRequests,
    upcomingBirthdays,
  };
}
