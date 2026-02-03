import {
  type RouteConfig,
  index,
  route,
  layout,
  prefix,
} from "@react-router/dev/routes";

export default [

  // Admin routes (with layout protection)
  route("admin/login", "routes/admin/login.tsx"),
  layout("routes/admin/layout.tsx", [
    route("admin/dashboard", "routes/admin/dashboard.tsx"),
    route("admin/members", "routes/admin/members/index.tsx"),
    route("admin/members/:id", "routes/admin/members/detail.tsx"),
    route("admin/plans", "routes/admin/plans.tsx"),
    route("admin/memberships", "routes/admin/memberships.tsx"),
    route("admin/payments", "routes/admin/payments.tsx"),
    route("admin/access", "routes/admin/access.tsx"),
    route("admin/exercises", "routes/admin/exercises.tsx"),
    route("admin/routines", "routes/admin/routines.tsx"),
    route("admin/reports", "routes/admin/reports.tsx"),
    route("admin/settings", "routes/admin/settings.tsx"),
  ]),

  // Client PWA routes
  route("app/login", "routes/app/login.tsx"),
  layout("routes/app/layout.tsx", [
    route("app/me", "routes/app/me.tsx"),
    route("app/qr", "routes/app/qr.tsx"),
    route("app/history", "routes/app/history.tsx"),
    route("app/my-week", "routes/app/my-week.tsx"),
    route("app/my-week/:day", "routes/app/my-week.$day.tsx"),
    route("app/routines", "routes/app/routines.tsx"),
    route("app/routines/create", "routes/app/routines.create.tsx"),
    route("app/routines/:id", "routes/app/routines.$id.tsx"),
  ]),
] satisfies RouteConfig;
