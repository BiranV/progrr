"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
    Calendar,
    Eye,
    EyeOff,
    Lock,
    Mail,
    Phone,
    User,
    X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n/useI18n";
import LanguageSwitcher from "@/components/LanguageSwitcher";

type ViewState = "login" | "signup";

type InitialView = "landing" | "login" | "signup";

type TermsModalType = "terms" | "privacy" | null;

type AuthStepProps = {
    nextPath: string;
    initialView?: InitialView;
    initialEmail?: string;
    onViewChange?: (view: ViewState) => void;
    registerBackHandler?: (handler: () => void) => void;
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRegex = /^05\d-?\d{7}$/;
const nameRegex = /^[\p{L}\s]+$/u;
const passwordComplexityRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

export default function AdminAuthStep({
    nextPath: _nextPath,
    initialView,
    initialEmail,
    onViewChange,
    registerBackHandler,
}: AuthStepProps) {
    const { t } = useI18n();
    const [view, setView] = useState<ViewState>(
        initialView === "signup" ? "signup" : "login",
    );

    useEffect(() => {
        onViewChange?.(view);
    }, [onViewChange, view]);

    useEffect(() => {
        registerBackHandler?.(() => setView("login"));
    }, [registerBackHandler]);

    const [loginEmail, setLoginEmail] = useState(initialEmail ?? "");
    const [loginPassword, setLoginPassword] = useState("");
    const [loginShowPassword, setLoginShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [loginErrors, setLoginErrors] = useState<{
        email: string | null;
        password: string | null;
    }>({ email: null, password: null });

    const [forgotOpen, setForgotOpen] = useState(false);
    const [forgotEmail, setForgotEmail] = useState("");
    const [forgotError, setForgotError] = useState<string | null>(null);
    const [forgotSent, setForgotSent] = useState<string | null>(null);

    const [signupFullName, setSignupFullName] = useState("");
    const [signupEmail, setSignupEmail] = useState("");
    const [signupPhone, setSignupPhone] = useState("");
    const [signupPassword, setSignupPassword] = useState("");
    const [signupShowPassword, setSignupShowPassword] = useState(false);
    const [signupAgreeTerms, setSignupAgreeTerms] = useState(false);
    const [signupErrors, setSignupErrors] = useState<{
        fullName: string | null;
        email: string | null;
        phone: string | null;
        password: string | null;
        terms: string | null;
    }>({
        fullName: null,
        email: null,
        phone: null,
        password: null,
        terms: null,
    });

    const [termsModal, setTermsModal] = useState<{
        isOpen: boolean;
        type: TermsModalType;
    }>({ isOpen: false, type: null });

    const isLogin = view === "login";

    const validateLogin = () => {
        const errors = { email: null as string | null, password: null as string | null };

        if (!loginEmail.trim()) {
            errors.email = t("auth.login.validation.emailRequired");
        } else if (!emailRegex.test(loginEmail)) {
            errors.email = t("auth.login.validation.emailInvalid");
        }

        if (!loginPassword.trim()) {
            errors.password = t("auth.login.validation.passwordRequired");
        } else if (loginPassword.length < 6) {
            errors.password = t("auth.login.validation.passwordLength");
        }

        setLoginErrors(errors);
        return !errors.email && !errors.password;
    };

    const validateSignup = () => {
        const errors = {
            fullName: null as string | null,
            email: null as string | null,
            phone: null as string | null,
            password: null as string | null,
            terms: null as string | null,
        };

        const trimmedName = signupFullName.trim();
        if (!trimmedName) {
            errors.fullName = t("auth.signup.validation.fullNameRequired");
        } else if (trimmedName.length < 2) {
            errors.fullName = t("auth.signup.validation.fullNameLength");
        } else if (!nameRegex.test(trimmedName)) {
            errors.fullName = t("auth.signup.validation.fullNameChars");
        }

        if (!signupEmail.trim()) {
            errors.email = t("auth.signup.validation.emailRequired");
        } else if (!emailRegex.test(signupEmail)) {
            errors.email = t("auth.signup.validation.emailInvalid");
        }

        if (!signupPhone.trim()) {
            errors.phone = t("auth.signup.validation.phoneRequired");
        } else if (!phoneRegex.test(signupPhone)) {
            errors.phone = t("auth.signup.validation.phoneInvalid");
        }

        if (!signupPassword.trim()) {
            errors.password = t("auth.signup.validation.passwordRequired");
        } else if (signupPassword.length < 8) {
            errors.password = t("auth.signup.validation.passwordLength");
        } else if (!passwordComplexityRegex.test(signupPassword)) {
            errors.password = t("auth.signup.validation.passwordComplexity");
        }

        if (!signupAgreeTerms) {
            errors.terms = t("auth.signup.validation.termsRequired");
        }

        setSignupErrors(errors);
        return (
            !errors.fullName &&
            !errors.email &&
            !errors.phone &&
            !errors.password &&
            !errors.terms
        );
    };

    const handleLoginSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (validateLogin()) {
            // TODO: Implement login
        }
    };

    const handleSignupSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (validateSignup()) {
            // TODO: Implement signup
        }
    };

    const handleForgotSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        setForgotError(null);
        setForgotSent(null);

        if (!forgotEmail.trim()) {
            setForgotError(t("auth.login.validation.emailRequiredFirst"));
            return;
        }

        if (!emailRegex.test(forgotEmail)) {
            setForgotError(t("auth.login.validation.emailInvalidFirst"));
            return;
        }

        setForgotSent(t("auth.login.forgotPasswordSent", { email: forgotEmail }));
    };

    const modalContent = useMemo(() => {
        if (termsModal.type === "terms") {
            return {
                title: t("auth.termsModal.title"),
                sections: [
                    {
                        title: t("auth.termsModal.sections.acceptance.title"),
                        text: t("auth.termsModal.sections.acceptance.body"),
                    },
                    {
                        title: t("auth.termsModal.sections.usage.title"),
                        text: t("auth.termsModal.sections.usage.body"),
                    },
                    {
                        title: t("auth.termsModal.sections.account.title"),
                        text: t("auth.termsModal.sections.account.body"),
                    },
                    {
                        title: t("auth.termsModal.sections.changes.title"),
                        text: t("auth.termsModal.sections.changes.body"),
                    },
                ],
            };
        }

        return {
            title: t("auth.privacyModal.title"),
            sections: [
                {
                    title: t("auth.privacyModal.sections.collection.title"),
                    text: t("auth.privacyModal.sections.collection.body"),
                },
                {
                    title: t("auth.privacyModal.sections.usage.title"),
                    text: t("auth.privacyModal.sections.usage.body"),
                },
                {
                    title: t("auth.privacyModal.sections.security.title"),
                    text: t("auth.privacyModal.sections.security.body"),
                },
                {
                    title: t("auth.privacyModal.sections.sharing.title"),
                    text: t("auth.privacyModal.sections.sharing.body"),
                },
                {
                    title: t("auth.privacyModal.sections.cookies.title"),
                    text: t("auth.privacyModal.sections.cookies.body"),
                },
            ],
        };
    }, [t, termsModal.type]);

    return (
        <div className="flex flex-col min-h-screen p-4">
            <div className="fixed top-4 z-40 w-full flex justify-center">
                <LanguageSwitcher variant="light" />
            </div>
            <AnimatePresence mode="wait">
                {isLogin ? (
                    <motion.div
                        key="login"
                        className="space-y-4"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3 }}
                    >
                        <motion.div
                            className="flex justify-center pt-4"
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5 }}
                        >
                            <div className="w-20 h-20 bg-teal-100 rounded-full flex items-center justify-center">
                                <Calendar className="w-10 h-10 text-teal-600" />
                            </div>
                        </motion.div>

                        <motion.div
                            className="text-center"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.2 }}
                        >
                            <h1 className="text-xl font-bold text-gray-900 mb-1">
                                {t("auth.login.title")}
                            </h1>
                            <p className="text-gray-500 text-xs">
                                {t("auth.login.subtitle")}
                            </p>
                        </motion.div>

                        <motion.form
                            onSubmit={handleLoginSubmit}
                            className="space-y-3"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                        >
                            <div className="space-y-1.5">
                                <Label htmlFor="loginEmail" className="text-gray-700 font-medium text-sm">
                                    {t("auth.login.emailLabel")} <span className="text-red-500">*</span>
                                </Label>
                                <div className="relative">
                                    <Mail className="absolute auth-icon-start top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <Input
                                        id="loginEmail"
                                        type="email"
                                        placeholder={t("auth.login.emailPlaceholder")}
                                        value={loginEmail}
                                        onChange={(event) => {
                                            setLoginEmail(event.target.value);
                                            if (loginErrors.email) {
                                                setLoginErrors((prev) => ({ ...prev, email: null }));
                                            }
                                        }}
                                        className={`h-11 rounded-xl bg-gray-50 focus:bg-white auth-input-start text-start ${loginErrors.email
                                            ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                                            : "border-gray-200 focus:border-teal-500 focus:ring-teal-500"
                                            }`}
                                        required
                                    />
                                </div>
                                {loginErrors.email && (
                                    <p className="text-sm text-red-500 mt-1">{loginErrors.email}</p>
                                )}
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="loginPassword" className="text-gray-700 font-medium text-sm">
                                    {t("auth.login.passwordLabel")} <span className="text-red-500">*</span>
                                </Label>
                                <div className="relative">
                                    <Lock className="absolute auth-icon-start top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <Input
                                        id="loginPassword"
                                        type={loginShowPassword ? "text" : "password"}
                                        placeholder={t("auth.login.passwordPlaceholder")}
                                        value={loginPassword}
                                        onChange={(event) => {
                                            setLoginPassword(event.target.value);
                                            if (loginErrors.password) {
                                                setLoginErrors((prev) => ({ ...prev, password: null }));
                                            }
                                        }}
                                        className={`h-11 rounded-xl bg-gray-50 focus:bg-white auth-input-start auth-input-end text-start ${loginErrors.password
                                            ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                                            : "border-gray-200 focus:border-teal-500 focus:ring-teal-500"
                                            }`}
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setLoginShowPassword((prev) => !prev)}
                                        className="absolute auth-icon-end top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                        aria-label={
                                            loginShowPassword
                                                ? t("auth.login.passwordLabel")
                                                : t("auth.login.passwordLabel")
                                        }
                                    >
                                        {loginShowPassword ? (
                                            <EyeOff className="w-5 h-5" />
                                        ) : (
                                            <Eye className="w-5 h-5" />
                                        )}
                                    </button>
                                </div>
                                {loginErrors.password && (
                                    <p className="text-sm text-red-500 mt-1">{loginErrors.password}</p>
                                )}
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Checkbox
                                        id="remember"
                                        checked={rememberMe}
                                        onCheckedChange={(checked) => setRememberMe(Boolean(checked))}
                                        className="border-gray-300 data-[state=checked]:bg-teal-500 data-[state=checked]:border-teal-500"
                                    />
                                    <Label htmlFor="remember" className="text-sm text-gray-600">
                                        {t("auth.login.rememberMe")}
                                    </Label>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setForgotOpen(true);
                                        setForgotEmail(loginEmail);
                                    }}
                                    className="text-sm text-teal-600 hover:text-teal-700 font-medium"
                                >
                                    {t("auth.login.forgotPassword")}
                                </button>
                            </div>

                            <Button
                                type="submit"
                                className="w-full h-12 bg-teal-500 hover:bg-teal-600 text-white rounded-xl text-base font-semibold shadow-lg shadow-teal-500/30"
                            >
                                {t("auth.login.button")}
                            </Button>

                            <div className="relative my-4">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-gray-200" />
                                </div>
                                <div className="relative flex justify-center">
                                    <span className="ps-4 pe-4 bg-gradient-to-b from-teal-50 to-white text-gray-500 text-sm">
                                        {t("auth.login.divider")}
                                    </span>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="flex-1 h-12 rounded-xl border-gray-200 hover:bg-gray-50"
                                >
                                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                    </svg>
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="flex-1 h-12 rounded-xl border-gray-200 hover:bg-gray-50"
                                >
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
                                    </svg>
                                </Button>
                            </div>

                            <div className="text-center pt-2">
                                <p className="text-gray-600 text-sm">
                                    {t("auth.login.noAccountPrefix")} {" "}
                                    <button
                                        type="button"
                                        onClick={() => setView("signup")}
                                        className="text-teal-600 hover:text-teal-700 font-semibold"
                                    >
                                        {t("auth.login.noAccountCta")}
                                    </button>
                                </p>
                            </div>
                        </motion.form>
                    </motion.div>
                ) : (
                    <motion.div
                        key="signup"
                        className="space-y-4"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3 }}
                    >
                        <motion.div
                            className="flex justify-center pt-4"
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5 }}
                        >
                            <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center">
                                <Calendar className="w-8 h-8 text-teal-600" />
                            </div>
                        </motion.div>

                        <motion.div
                            className="text-center"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.2 }}
                        >
                            <h1 className="text-xl font-bold text-gray-900 mb-1">
                                {t("auth.signup.title")}
                            </h1>
                            <p className="text-gray-500 text-xs">
                                {t("auth.signup.subtitle")}
                            </p>
                        </motion.div>

                        <motion.form
                            onSubmit={handleSignupSubmit}
                            className="space-y-3"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                        >
                            <div className="space-y-1.5">
                                <Label htmlFor="fullName" className="text-gray-700 font-medium text-sm">
                                    {t("auth.signup.fullNameLabel")} <span className="text-red-500">*</span>
                                </Label>
                                <div className="relative">
                                    <User className="absolute auth-icon-start top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <Input
                                        id="fullName"
                                        type="text"
                                        placeholder={t("auth.signup.fullNamePlaceholder")}
                                        value={signupFullName}
                                        onChange={(event) => {
                                            setSignupFullName(event.target.value);
                                            if (signupErrors.fullName) {
                                                setSignupErrors((prev) => ({ ...prev, fullName: null }));
                                            }
                                        }}
                                        className={`h-11 rounded-xl bg-gray-50 focus:bg-white auth-input-start text-start ${signupErrors.fullName
                                            ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                                            : "border-gray-200 focus:border-teal-500 focus:ring-teal-500"
                                            }`}
                                        required
                                    />
                                </div>
                                {signupErrors.fullName && (
                                    <p className="text-sm text-red-500 mt-1">{signupErrors.fullName}</p>
                                )}
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="signupEmail" className="text-gray-700 font-medium text-sm">
                                    {t("auth.signup.emailLabel")} <span className="text-red-500">*</span>
                                </Label>
                                <div className="relative">
                                    <Mail className="absolute auth-icon-start top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <Input
                                        id="signupEmail"
                                        type="email"
                                        placeholder={t("auth.signup.emailPlaceholder")}
                                        value={signupEmail}
                                        onChange={(event) => {
                                            setSignupEmail(event.target.value);
                                            if (signupErrors.email) {
                                                setSignupErrors((prev) => ({ ...prev, email: null }));
                                            }
                                        }}
                                        className={`h-11 rounded-xl bg-gray-50 focus:bg-white auth-input-start text-start ${signupErrors.email
                                            ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                                            : "border-gray-200 focus:border-teal-500 focus:ring-teal-500"
                                            }`}
                                        required
                                    />
                                </div>
                                {signupErrors.email && (
                                    <p className="text-sm text-red-500 mt-1">{signupErrors.email}</p>
                                )}
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="phone" className="text-gray-700 font-medium text-sm">
                                    {t("auth.signup.phoneLabel")} <span className="text-red-500">*</span>
                                </Label>
                                <div className="relative">
                                    <Phone className="absolute auth-icon-start top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <Input
                                        id="phone"
                                        type="tel"
                                        placeholder={t("auth.signup.phonePlaceholder")}
                                        value={signupPhone}
                                        onChange={(event) => {
                                            setSignupPhone(event.target.value);
                                            if (signupErrors.phone) {
                                                setSignupErrors((prev) => ({ ...prev, phone: null }));
                                            }
                                        }}
                                        className={`h-11 rounded-xl bg-gray-50 focus:bg-white auth-input-start text-start ${signupErrors.phone
                                            ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                                            : "border-gray-200 focus:border-teal-500 focus:ring-teal-500"
                                            }`}
                                        required
                                    />
                                </div>
                                {signupErrors.phone && (
                                    <p className="text-sm text-red-500 mt-1">{signupErrors.phone}</p>
                                )}
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="signupPassword" className="text-gray-700 font-medium text-sm">
                                    {t("auth.signup.passwordLabel")} <span className="text-red-500">*</span>
                                </Label>
                                <div className="relative">
                                    <Lock className="absolute auth-icon-start top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <Input
                                        id="signupPassword"
                                        type={signupShowPassword ? "text" : "password"}
                                        placeholder={t("auth.signup.passwordPlaceholder")}
                                        value={signupPassword}
                                        onChange={(event) => {
                                            setSignupPassword(event.target.value);
                                            if (signupErrors.password) {
                                                setSignupErrors((prev) => ({ ...prev, password: null }));
                                            }
                                        }}
                                        className={`h-11 rounded-xl bg-gray-50 focus:bg-white auth-input-start auth-input-end text-start ${signupErrors.password
                                            ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                                            : "border-gray-200 focus:border-teal-500 focus:ring-teal-500"
                                            }`}
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setSignupShowPassword((prev) => !prev)}
                                        className="absolute auth-icon-end top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                    >
                                        {signupShowPassword ? (
                                            <EyeOff className="w-5 h-5" />
                                        ) : (
                                            <Eye className="w-5 h-5" />
                                        )}
                                    </button>
                                </div>
                                {signupErrors.password && (
                                    <p className="text-sm text-red-500 mt-1">{signupErrors.password}</p>
                                )}
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Checkbox
                                        id="terms"
                                        checked={signupAgreeTerms}
                                        onCheckedChange={(checked) => {
                                            setSignupAgreeTerms(Boolean(checked));
                                            if (signupErrors.terms && checked) {
                                                setSignupErrors((prev) => ({ ...prev, terms: null }));
                                            }
                                        }}
                                        className={`border-gray-300 data-[state=checked]:bg-teal-500 data-[state=checked]:border-teal-500 mt-0.5 shrink-0 ${signupErrors.terms ? "border-red-500" : ""
                                            }`}
                                    />
                                    <Label
                                        htmlFor="terms"
                                        className="text-xs text-gray-600 cursor-pointer leading-snug flex-1 auth-terms-text text-start"
                                    >
                                        {t("auth.signup.termsPrefix")}
                                        <button
                                            type="button"
                                            onClick={() => setTermsModal({ isOpen: true, type: "terms" })}
                                            className="text-teal-600 hover:text-teal-700 font-medium ms-1 me-1 underline"
                                        >
                                            {t("auth.signup.termsLink")}
                                        </button>
                                        {t("auth.signup.termsConnector")}
                                        <button
                                            type="button"
                                            onClick={() => setTermsModal({ isOpen: true, type: "privacy" })}
                                            className="text-teal-600 hover:text-teal-700 font-medium ms-1 me-1 underline"
                                        >
                                            {t("auth.signup.privacyLink")}
                                        </button>
                                        <span className="text-red-500 ms-1">*</span>
                                    </Label>
                                </div>
                                {signupErrors.terms && (
                                    <p className="text-sm text-red-500 mt-1 ms-8">{signupErrors.terms}</p>
                                )}
                            </div>

                            <Button
                                type="submit"
                                disabled={!signupAgreeTerms}
                                className="w-full h-12 bg-teal-500 hover:bg-teal-600 text-white rounded-xl text-base font-semibold shadow-lg shadow-teal-500/30 mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {t("auth.signup.button")}
                            </Button>

                            <div className="relative my-4">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-gray-200" />
                                </div>
                                <div className="relative flex justify-center">
                                    <span className="ps-4 pe-4 bg-gradient-to-b from-teal-50 to-white text-gray-500 text-sm">
                                        {t("auth.signup.divider")}
                                    </span>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="flex-1 h-12 rounded-xl border-gray-200 hover:bg-gray-50"
                                >
                                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                    </svg>
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="flex-1 h-12 rounded-xl border-gray-200 hover:bg-gray-50"
                                >
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
                                    </svg>
                                </Button>
                            </div>

                            <div className="text-center pt-4">
                                <p className="text-gray-600">
                                    {t("auth.signup.haveAccountPrefix")} {" "}
                                    <button
                                        type="button"
                                        onClick={() => setView("login")}
                                        className="text-teal-600 hover:text-teal-700 font-semibold"
                                    >
                                        {t("auth.signup.haveAccountCta")}
                                    </button>
                                </p>
                            </div>
                        </motion.form>
                    </motion.div>
                )}
            </AnimatePresence>

            <TermsModal
                isOpen={termsModal.isOpen}
                onClose={() => setTermsModal({ isOpen: false, type: null })}
                content={modalContent}
            />

            <ForgotPasswordModal
                isOpen={forgotOpen}
                onClose={() => {
                    setForgotOpen(false);
                    setForgotError(null);
                    setForgotSent(null);
                }}
                email={forgotEmail}
                onEmailChange={(value) => {
                    setForgotEmail(value);
                    setForgotError(null);
                    setForgotSent(null);
                }}
                error={forgotError}
                sentMessage={forgotSent}
                onSubmit={handleForgotSubmit}
            />
        </div>
    );
}

function TermsModal({
    isOpen,
    onClose,
    content,
}: {
    isOpen: boolean;
    onClose: () => void;
    content: { title: string; sections: { title: string; text: string }[] };
}) {
    const { t } = useI18n();

    return (
        <AnimatePresence>
            {isOpen ? (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm"
                    />
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            transition={{ type: "spring", duration: 0.3 }}
                            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden pointer-events-auto"
                        >
                            <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white z-10">
                                <h2 className="text-2xl font-bold text-gray-900">
                                    {content.title}
                                </h2>
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors"
                                    aria-label={t("common.close")}
                                >
                                    <X className="w-5 h-5 text-gray-500" />
                                </button>
                            </div>

                            <div className="p-6 overflow-y-auto max-h-[calc(80vh-180px)]">
                                <div className="space-y-6">
                                    {content.sections.map((section, index) => (
                                        <div key={index}>
                                            <h3 className="text-lg font-bold text-gray-900 mb-2">
                                                {section.title}
                                            </h3>
                                            <p className="text-gray-600 leading-relaxed">
                                                {section.text}
                                            </p>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-8 p-4 bg-teal-50 rounded-xl border border-teal-100">
                                    <p className="text-sm text-teal-900">
                                        <strong>{t("auth.modalLastUpdatedLabel")}</strong> {t("auth.modalLastUpdatedDate")}
                                    </p>
                                    <p className="text-sm text-teal-700 mt-2">
                                        {t("auth.modalFooterNote")}
                                    </p>
                                </div>
                            </div>

                            <div className="p-6 border-t border-gray-100 bg-gray-50">
                                <Button
                                    type="button"
                                    onClick={onClose}
                                    className="w-full h-12 bg-teal-500 hover:bg-teal-600 text-white rounded-xl"
                                >
                                    {t("auth.modalAcknowledge")}
                                </Button>
                            </div>
                        </motion.div>
                    </div>
                </>
            ) : null}
        </AnimatePresence>
    );
}

function ForgotPasswordModal({
    isOpen,
    onClose,
    email,
    onEmailChange,
    onSubmit,
    error,
    sentMessage,
}: {
    isOpen: boolean;
    onClose: () => void;
    email: string;
    onEmailChange: (value: string) => void;
    onSubmit: (event: React.FormEvent) => void;
    error: string | null;
    sentMessage: string | null;
}) {
    const { t } = useI18n();

    return (
        <AnimatePresence>
            {isOpen ? (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm"
                    />
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            transition={{ type: "spring", duration: 0.3 }}
                            className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden pointer-events-auto"
                        >
                            <div className="flex items-center justify-between p-6 border-b border-gray-100">
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900">
                                        {t("auth.login.forgotPasswordTitle")}
                                    </h2>
                                    <p className="text-sm text-gray-500 mt-1">
                                        {t("auth.login.forgotPasswordSubtitle")}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors"
                                    aria-label={t("common.close")}
                                >
                                    <X className="w-5 h-5 text-gray-500" />
                                </button>
                            </div>

                            <form onSubmit={onSubmit} className="p-6 space-y-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="resetEmail" className="text-gray-700 font-medium text-sm">
                                        {t("auth.login.resetEmailLabel")}
                                    </Label>
                                    <div className="relative">
                                        <Mail className="absolute auth-icon-start top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        <Input
                                            id="resetEmail"
                                            type="email"
                                            placeholder={t("auth.login.emailPlaceholder")}
                                            value={email}
                                            onChange={(event) => onEmailChange(event.target.value)}
                                            className={`h-11 rounded-xl bg-gray-50 focus:bg-white auth-input-start text-start ${error
                                                ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                                                : "border-gray-200 focus:border-teal-500 focus:ring-teal-500"
                                                }`}
                                        />
                                    </div>
                                    {error ? <p className="text-sm text-red-500 mt-1">{error}</p> : null}
                                    {sentMessage ? (
                                        <p className="text-sm text-teal-600 mt-1">{sentMessage}</p>
                                    ) : null}
                                </div>

                                <div className="flex gap-3">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="flex-1 h-12 rounded-xl border-gray-200 hover:bg-gray-50"
                                        onClick={onClose}
                                    >
                                        {t("auth.login.forgotPasswordCancel")}
                                    </Button>
                                    <Button
                                        type="submit"
                                        className="flex-1 h-12 bg-teal-500 hover:bg-teal-600 text-white rounded-xl"
                                    >
                                        {t("auth.login.forgotPasswordSend")}
                                    </Button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                </>
            ) : null}
        </AnimatePresence>
    );
}
