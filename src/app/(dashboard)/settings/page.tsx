"use client";

import Link from "next/link";
import {
  Users,
  Shield,
  ScrollText,
  UserCircle,
  Bell,
  Upload,
} from "lucide-react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";

const SECTIONS = [
  {
    title: "User Management",
    description: "Manage user accounts, roles, and access",
    href: "/settings/users",
    icon: Users,
  },
  {
    title: "Role Management",
    description: "Configure permissions for each role",
    href: "/settings/roles",
    icon: Shield,
  },
  {
    title: "Audit Trail",
    description: "View system-wide activity and change logs",
    href: "/settings/audit-trail",
    icon: ScrollText,
  },
  {
    title: "Profile",
    description: "View your account info and change password",
    href: "/settings/profile",
    icon: UserCircle,
  },
  {
    title: "Notifications",
    description: "Configure notification preferences",
    href: "/settings/notifications",
    icon: Bell,
  },
  {
    title: "Data Import",
    description: "Import data from spreadsheets",
    href: "/settings/import",
    icon: Upload,
  },
] as const;

/**
 * Settings overview page showing cards that link to each
 * settings subsection. Acts as a hub for all configuration pages.
 */
export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage your account, users, roles, and system configuration."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map((section) => (
          <Link key={section.href} href={section.href}>
            <Card className="h-full transition-colors hover:bg-muted/30">
              <CardHeader>
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <section.icon className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-base">{section.title}</CardTitle>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
