"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
);

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, isLoadingAuth } = useAuth();

  useEffect(() => {
    if (!isLoadingAuth && isAuthenticated) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, isLoadingAuth, router]);

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-blue-50">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-purple-50 via-white to-indigo-50">
      {/* Animated Background Shapes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute top-40 right-10 w-72 h-72 bg-indigo-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      <div className="relative min-h-screen flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Side - Branding */}
          <div className="hidden lg:flex flex-col items-center justify-center text-center space-y-0">
            <div className="relative">
              <img
                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69538c86530afecdd4f04cee/9d28c112f_ChatGPTImageDec30202506_28_18PM-Photoroom.png"
                alt="Progrr Logo"
                className="relative w-64 h-64 object-contain drop-shadow-2xl"
              />
            </div>
            <div className="space-y-4 -mt-8">
              <h1 className="text-6xl font-black bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent pb-2">
                progrr
              </h1>
              <p className="text-xl text-gray-600 max-w-md">
                Transform your coaching business with intelligent client
                management
              </p>
              <div className="flex flex-wrap justify-center gap-4 pt-4">
                <div className="px-4 py-2 bg-white rounded-full shadow-md">
                  <span className="text-sm font-semibold text-purple-600">
                    📊 Track Progress
                  </span>
                </div>
                <div className="px-4 py-2 bg-white rounded-full shadow-md">
                  <span className="text-sm font-semibold text-indigo-600">
                    💪 Build Plans
                  </span>
                </div>
                <div className="px-4 py-2 bg-white rounded-full shadow-md">
                  <span className="text-sm font-semibold text-purple-600">
                    🎯 Achieve Goals
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side - Auth Form */}
          <div className="w-full max-w-md mx-auto">
            {/* Mobile Logo */}
            <div className="lg:hidden text-center mb-8">
              <img
                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69538c86530afecdd4f04cee/9d28c112f_ChatGPTImageDec30202506_28_18PM-Photoroom.png"
                alt="Progrr Logo"
                className="w-32 h-32 mx-auto object-contain mb-4"
              />
              <h1 className="text-4xl font-black bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent mb-2">
                Progrr
              </h1>
              <p className="text-gray-600">Your coaching companion</p>
            </div>

            <Card className="backdrop-blur-lg bg-white/80 shadow-2xl border-0 overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600"></div>
              <CardContent className="pt-8 pb-6 px-8 min-h-[500px] flex flex-col">
                <Tabs
                  defaultValue="login"
                  className="w-full flex-1 flex flex-col"
                >
                  <TabsList className="grid w-full grid-cols-2 bg-gray-100 p-1 rounded-xl mb-6 h-12">
                    <TabsTrigger
                      value="login"
                      className="rounded-lg h-10 cursor-pointer data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all"
                    >
                      Login
                    </TabsTrigger>
                    <TabsTrigger
                      value="register"
                      className="rounded-lg h-10 cursor-pointer data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all"
                    >
                      Register
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="login" className="flex-1 flex flex-col">
                    <LoginForm />
                  </TabsContent>

                  <TabsContent
                    value="register"
                    className="flex-1 flex flex-col"
                  >
                    <RegisterForm />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            <p className="text-center text-sm text-gray-500 mt-6">
              By continuing, you agree to our Terms & Privacy Policy
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoginForm() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
  }>({});
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setFieldErrors({});

    let hasError = false;
    const newFieldErrors: { email?: string; password?: string } = {};

    if (!email) {
      newFieldErrors.email = "Email is required";
      hasError = true;
    }
    if (!password) {
      newFieldErrors.password = "Password is required";
      hasError = true;
    }

    if (hasError) {
      setFieldErrors(newFieldErrors);
      return;
    }

    setLoading(true);

    try {
      await login(email, password);
      // Navigation is handled by the parent component's useEffect
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 flex-1 flex flex-col"
      noValidate
    >
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-700">
          Email Address
        </label>
        <Input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (fieldErrors.email)
              setFieldErrors({ ...fieldErrors, email: undefined });
          }}
          placeholder="coach@example.com"
          className={`h-12 px-4 border-2 focus:border-purple-500 rounded-xl transition-all ${
            fieldErrors.email ? "border-red-500 bg-red-50" : "border-gray-200"
          }`}
        />
        {fieldErrors.email && (
          <p className="text-sm text-red-500 mt-1">{fieldErrors.email}</p>
        )}
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-700">
          Password
        </label>
        <Input
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (fieldErrors.password)
              setFieldErrors({ ...fieldErrors, password: undefined });
          }}
          placeholder="••••••••"
          className={`h-12 px-4 border-2 focus:border-purple-500 rounded-xl transition-all ${
            fieldErrors.password
              ? "border-red-500 bg-red-50"
              : "border-gray-200"
          }`}
        />
        {fieldErrors.password && (
          <p className="text-sm text-red-500 mt-1">{fieldErrors.password}</p>
        )}
      </div>
      {error && (
        <div className="text-sm text-red-600 bg-red-50 p-3 rounded-xl border border-red-200">
          {error}
        </div>
      )}
      <Button
        type="submit"
        className="w-full h-12 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-[1.02] mt-auto"
        disabled={loading}
      >
        {loading ? "Logging in..." : "Login to your account"}
      </Button>

      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-2 text-gray-500">Or continue with</span>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full h-12 border-2 border-gray-200 hover:bg-gray-50 hover:border-gray-300 text-gray-700 font-semibold rounded-xl transition-all"
        onClick={() => {
          // Handle Google Login
          console.log("Google login clicked");
        }}
      >
        <GoogleIcon />
        <span className="ml-2">Google</span>
      </Button>
    </form>
  );
}

function RegisterForm() {
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
  }>({});
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setFieldErrors({});

    let hasError = false;
    const newFieldErrors: { name?: string; email?: string; password?: string } =
      {};

    if (!name) {
      newFieldErrors.name = "Full Name is required";
      hasError = true;
    }
    if (!email) {
      newFieldErrors.email = "Email is required";
      hasError = true;
    }
    if (!password) {
      newFieldErrors.password = "Password is required";
      hasError = true;
    }

    if (hasError) {
      setFieldErrors(newFieldErrors);
      return;
    }

    setLoading(true);

    try {
      await register({ email, password, full_name: name });
      // Navigation is handled by the parent component's useEffect
    } catch (err: any) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 flex-1 flex flex-col"
      noValidate
    >
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-700">
          Full Name
        </label>
        <Input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (fieldErrors.name)
              setFieldErrors({ ...fieldErrors, name: undefined });
          }}
          placeholder="John Doe"
          className={`h-12 px-4 border-2 focus:border-purple-500 rounded-xl transition-all ${
            fieldErrors.name ? "border-red-500 bg-red-50" : "border-gray-200"
          }`}
        />
        {fieldErrors.name && (
          <p className="text-sm text-red-500 mt-1">{fieldErrors.name}</p>
        )}
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-700">
          Email Address
        </label>
        <Input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (fieldErrors.email)
              setFieldErrors({ ...fieldErrors, email: undefined });
          }}
          placeholder="coach@example.com"
          className={`h-12 px-4 border-2 focus:border-purple-500 rounded-xl transition-all ${
            fieldErrors.email ? "border-red-500 bg-red-50" : "border-gray-200"
          }`}
        />
        {fieldErrors.email && (
          <p className="text-sm text-red-500 mt-1">{fieldErrors.email}</p>
        )}
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-700">
          Password
        </label>
        <Input
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (fieldErrors.password)
              setFieldErrors({ ...fieldErrors, password: undefined });
          }}
          placeholder="••••••••"
          className={`h-12 px-4 border-2 focus:border-purple-500 rounded-xl transition-all ${
            fieldErrors.password
              ? "border-red-500 bg-red-50"
              : "border-gray-200"
          }`}
        />
        {fieldErrors.password && (
          <p className="text-sm text-red-500 mt-1">{fieldErrors.password}</p>
        )}
      </div>
      {error && (
        <div className="text-sm text-red-600 bg-red-50 p-3 rounded-xl border border-red-200">
          {error}
        </div>
      )}
      <Button
        type="submit"
        className="w-full h-12 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-[1.02] mt-auto"
        disabled={loading}
      >
        {loading ? "Creating account..." : "Create your account"}
      </Button>

      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-2 text-gray-500">Or continue with</span>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full h-12 border-2 border-gray-200 hover:bg-gray-50 hover:border-gray-300 text-gray-700 font-semibold rounded-xl transition-all"
        onClick={() => {
          // Handle Google Login
          console.log("Google login clicked");
        }}
      >
        <GoogleIcon />
        <span className="ml-2">Google</span>
      </Button>
    </form>
  );
}
