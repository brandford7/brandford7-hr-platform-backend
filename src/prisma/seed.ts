import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { env } from "../config/env";

const connectionString = `${env.DATABASE_URL}`;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const PRIVILEGES = [
  {
    name: "DashboardView",
    resource: "dashboard",
    action: "view",
    description: "View dashboard statistics",
  },
  {
    name: "EmployeeView",
    resource: "employee",
    action: "view",
    description: "View employee records",
  },
  {
    name: "EmployeeCreate",
    resource: "employee",
    action: "create",
    description: "Create new employees",
  },
  {
    name: "EmployeeEdit",
    resource: "employee",
    action: "edit",
    description: "Edit employee records",
  },
  {
    name: "EmployeeDelete",
    resource: "employee",
    action: "delete",
    description: "Delete employee records",
  },
  {
    name: "EmployeeViewSalary",
    resource: "employee",
    action: "view_salary",
    description: "View salary information",
  },
  {
    name: "DepartmentView",
    resource: "department",
    action: "view",
    description: "View departments",
  },
  {
    name: "DepartmentCreate",
    resource: "department",
    action: "create",
    description: "Create departments",
  },
  {
    name: "DepartmentEdit",
    resource: "department",
    action: "edit",
    description: "Edit departments",
  },
  {
    name: "DepartmentDelete",
    resource: "department",
    action: "delete",
    description: "Delete departments",
  },
  {
    name: "JobPositionView",
    resource: "job_position",
    action: "view",
    description: "View job positions",
  },
  {
    name: "JobPositionCreate",
    resource: "job_position",
    action: "create",
    description: "Create job positions",
  },
  {
    name: "JobPositionEdit",
    resource: "job_position",
    action: "edit",
    description: "Edit job positions",
  },
  {
    name: "LeaveView",
    resource: "leave",
    action: "view",
    description: "View own leave requests",
  },
  {
    name: "LeaveViewAll",
    resource: "leave",
    action: "view_all",
    description: "View all employees leave requests",
  },
  {
    name: "LeaveCreate",
    resource: "leave",
    action: "create",
    description: "Submit leave requests",
  },
  {
    name: "LeaveApprove",
    resource: "leave",
    action: "approve",
    description: "Approve or reject leave requests",
  },
  {
    name: "LeaveCancel",
    resource: "leave",
    action: "cancel",
    description: "Cancel leave requests",
  },
  {
    name: "LeaveTypeView",
    resource: "leave_type",
    action: "view",
    description: "View leave types",
  },
  {
    name: "LeaveTypeCreate",
    resource: "leave_type",
    action: "create",
    description: "Create leave types",
  },
  {
    name: "LeaveTypeEdit",
    resource: "leave_type",
    action: "edit",
    description: "Edit leave types",
  },
  {
    name: "LeaveTypeDelete",
    resource: "leave_type",
    action: "delete",
    description: "Deactivate leave types",
  },
  {
    name: "AttendanceView",
    resource: "attendance",
    action: "view",
    description: "View own attendance",
  },
  {
    name: "AttendanceViewAll",
    resource: "attendance",
    action: "view_all",
    description: "View all attendance records",
  },
  {
    name: "AttendanceCheckIn",
    resource: "attendance",
    action: "check_in",
    description: "Check in and check out",
  },
  {
    name: "RoleView",
    resource: "role",
    action: "view",
    description: "View roles and duties",
  },
  {
    name: "RoleManage",
    resource: "role",
    action: "manage",
    description: "Manage roles and duty assignments",
  },
  {
    name: "AuditView",
    resource: "audit",
    action: "view",
    description: "View audit logs",
  },
  {
    name: "AnnouncementView",
    resource: "announcement",
    action: "view",
    description: "View announcements",
  },
  {
    name: "AnnouncementManage",
    resource: "announcement",
    action: "manage",
    description: "Create and publish announcements",
  },
  {
    name: "HolidayManage",
    resource: "holiday",
    action: "manage",
    description: "Manage holidays",
  },
  {
    name: "HolidayView",
    resource: "holiday",
    action: "view",
    description: "View holidays",
  },
  {
    name: "HolidayCreate",
    resource: "holiday",
    action: "create",
    description: "Create holidays",
  },
  {
    name: "HolidayEdit",
    resource: "holiday",
    action: "edit",
    description: "Edit holidays",
  },
  {
    name: "HolidayDelete",
    resource: "holiday",
    action: "delete",
    description: "Delete holidays",
  },
];

const DUTIES = [
  {
    name: "SystemAdmin",
    displayName: "System Administrator",
    description: "Absolute access to all system privileges",
    privileges: PRIVILEGES.map((p) => p.name),
  },
  {
    name: "HRManagement",
    displayName: "HR Management",
    description:
      "Access to all HR, Employee, and Role management functions. Excludes system audit logs.",
    privileges: PRIVILEGES.filter((p) => p.resource !== "audit").map(
      (p) => p.name,
    ),
  },
  {
    name: "SubmitLeave",
    displayName: "Submit Leave",
    description: "Submit and manage own leave requests",
    privileges: ["LeaveView", "LeaveCreate", "LeaveCancel", "LeaveTypeView"],
  },
  {
    name: "TrackAttendance",
    displayName: "Track Attendance",
    description: "Check in/out and view own attendance",
    privileges: ["AttendanceView", "AttendanceCheckIn"],
  },
  {
    name: "ViewDashboard",
    displayName: "View Dashboard",
    description: "Access to dashboard statistics",
    privileges: ["DashboardView"],
  },
];

const ROLE_DUTIES: Record<string, string[]> = {
  ADMIN: ["SystemAdmin"],
  MANAGER: ["HRManagement", "SubmitLeave", "TrackAttendance"],
  EMPLOYEE: ["ViewDashboard", "SubmitLeave", "TrackAttendance"],
};

async function main() {
  console.log("🚀 Seeding database...\n");

  // 1. PRIVILEGES
  const createdPrivileges = await Promise.all(
    PRIVILEGES.map((p) =>
      prisma.privilege.upsert({
        where: { name: p.name },
        update: {
          description: p.description,
          resource: p.resource,
          action: p.action,
        },
        create: p,
      }),
    ),
  );
  console.log(`✅ ${createdPrivileges.length} privileges seeded`);

  const privMap = Object.fromEntries(
    createdPrivileges.map((p) => [p.name, p.id]),
  );

  // 2. DUTIES
  for (const duty of DUTIES) {
    const created = await prisma.duty.upsert({
      where: { name: duty.name },
      update: { displayName: duty.displayName, description: duty.description },
      create: {
        name: duty.name,
        displayName: duty.displayName,
        description: duty.description,
      },
    });

    await prisma.dutyPrivilege.deleteMany({ where: { dutyId: created.id } });
    await prisma.dutyPrivilege.createMany({
      data: duty.privileges.map((privName) => ({
        dutyId: created.id,
        privilegeId: privMap[privName]!,
      })),
    });
  }
  console.log(`✅ ${DUTIES.length} duties seeded`);

  const dutyMap = Object.fromEntries(
    (await prisma.duty.findMany()).map((d) => [d.name, d.id]),
  );

  // 3. ROLES
  const roleDefinitions = [
    {
      name: "ADMIN",
      displayName: "Administrator",
      description: "Full system access",
      isSystem: true,
    },
    {
      name: "MANAGER",
      displayName: "HR Manager",
      description: "Full HR and Role management",
      isSystem: true,
    },
    {
      name: "EMPLOYEE",
      displayName: "Employee",
      description: "Standard employee access",
      isSystem: true,
    },
  ];

  for (const roleDef of roleDefinitions) {
    const role = await prisma.role.upsert({
      where: { name: roleDef.name },
      update: {
        displayName: roleDef.displayName,
        description: roleDef.description,
      },
      create: roleDef,
    });

    await prisma.roleDuty.deleteMany({ where: { roleId: role.id } });
    await prisma.roleDuty.createMany({
      data: (ROLE_DUTIES[roleDef.name] ?? []).map((dutyName) => ({
        roleId: role.id,
        dutyId: dutyMap[dutyName]!,
      })),
    });
  }
  console.log("✅ Roles seeded");

  // 4. LEAVE TYPES
  const leaveTypes = [
    {
      name: "Annual Leave",
      description: "Paid yearly vacation",
      defaultDays: 21,
      isPaid: true,
      colorHex: "#3B82F6",
    },
    {
      name: "Sick Leave",
      description: "Leave due to illness",
      defaultDays: 10,
      isPaid: true,
      colorHex: "#EF4444",
    },
    {
      name: "Maternity Leave",
      description: "Leave for new mothers",
      defaultDays: 84,
      isPaid: true,
      colorHex: "#EC4899",
      maxConsecutiveDays: 84,
    },
    {
      name: "Paternity Leave",
      description: "Leave for new fathers",
      defaultDays: 5,
      isPaid: true,
      colorHex: "#8B5CF6",
      maxConsecutiveDays: 5,
    },
    {
      name: "Study Leave",
      description: "Academic or exam leave",
      defaultDays: 5,
      isPaid: false,
      colorHex: "#F59E0B",
    },
    {
      name: "Compassionate Leave",
      description: "Bereavement or family crisis",
      defaultDays: 3,
      isPaid: true,
      colorHex: "#6B7280",
      maxConsecutiveDays: 3,
    },
    {
      name: "Unpaid Leave",
      description: "Unpaid personal leave",
      defaultDays: 30,
      isPaid: false,
      colorHex: "#9CA3AF",
    },
  ];

  await Promise.all(
    leaveTypes.map((lt) =>
      prisma.leaveType.upsert({
        where: { name: lt.name },
        update: {},
        create: lt,
      }),
    ),
  );
  console.log(`✅ ${leaveTypes.length} leave types seeded`);

  // 5. DEPARTMENTS
  const departments = [
    "Engineering",
    "Human Resources",
    "Finance",
    "Marketing",
    "Operations",
    "Sales",
  ];
  await Promise.all(
    departments.map((name) =>
      prisma.department.upsert({
        where: { name },
        update: {},
        create: { name },
      }),
    ),
  );
  console.log(`✅ ${departments.length} departments seeded`);

  // 6. ADMIN USER
  const adminRole = await prisma.role.findUniqueOrThrow({
    where: { name: "ADMIN" },
  });
  const adminEmail = "admin@hrplatform.com";
  const adminExists = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!adminExists) {
    const passwordHash = await bcrypt.hash("Admin@123456", 12);
    const adminUser = await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        roleId: adminRole.id,
        mustChangePassword: true,
        passwordChangedAt: new Date(),
      },
    });
    await prisma.employee.create({
      data: {
        userId: adminUser.id,
        employeeCode: "EMP-0001",
        firstName: "System",
        lastName: "Administrator",
        hireDate: new Date(),
        status: "ACTIVE",
      },
    });
    console.log("✅ Admin user created (admin@hrplatform.com)");
  }

  // 7. MANAGER (HR) USER
  const managerRole = await prisma.role.findUniqueOrThrow({
    where: { name: "MANAGER" },
  });
  const hrEmail = "manager@hrplatform.com";
  const hrExists = await prisma.user.findUnique({ where: { email: hrEmail } });

  if (!hrExists) {
    const passwordHash = await bcrypt.hash("Hr@123456", 12);
    const hrUser = await prisma.user.create({
      data: {
        email: hrEmail,
        passwordHash,
        roleId: managerRole.id,
        mustChangePassword: true,
      },
    });
    await prisma.employee.create({
      data: {
        userId: hrUser.id,
        employeeCode: "EMP-0002",
        firstName: "Jane",
        lastName: "Doe",
        hireDate: new Date(),
        status: "ACTIVE",
      },
    });
    console.log("✅ Demo HR Manager created (manager@hrplatform.com)");
  }

  console.log("\n🌱 Seed complete!");
}

main()
  .catch((e) => {
    console.error(" Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
