"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(t("invalidCredentials"));
        setIsLoading(false);
        return;
      }

      if (result?.ok) {
        router.push("/");
        router.refresh();
        return;
      }
    } catch {
      setError(t("invalidCredentials"));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md rounded-2xl border-gray-200/80 bg-white/95 shadow-xl shadow-gray-200/50 backdrop-blur-sm">
      <CardHeader className="space-y-1 pb-2 text-center">
        <div className="mb-4">
          <h1 className="bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-3xl font-bold tracking-tight text-transparent">
            BatuFlow
          </h1>
        </div>
        <CardTitle className="text-xl font-semibold">{t("loginTitle")}</CardTitle>
        <CardDescription>{t("loginSubtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t("email")}</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
              className="h-10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t("password")}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              className="h-10"
            />
          </div>
          {error && (
            <div
              role="alert"
              className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </div>
          )}
          <Button
            type="submit"
            disabled={isLoading}
            className="h-10 w-full bg-blue-600 font-medium text-white hover:bg-blue-700"
          >
            {isLoading ? tCommon("loading") : t("loginButton")}
          </Button>
        </form>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Distribution & Wholesale ERP
        </p>
      </CardContent>
    </Card>
  );
}
