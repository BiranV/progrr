import { Mail } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import SettingsBackHeader from "@/components/settings/SettingsBackHeader";

export default function SupportPage() {
  return (
    <div className="space-y-6">
      <div className="mb-2">
        <SettingsBackHeader />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Support
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Need help? We’re here to assist you.
        </p>
      </div>

      <div className="grid gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              Contact Support
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Send a message to our support team.
            </p>
            <Button asChild className="rounded-2xl">
              <a href="mailto:support@progrr.io">Email support@progrr.io</a>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Support information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <div>We usually respond within 24 business hours.</div>
          <div>Sunday–Thursday, 09:00–18:00 (GMT+2)</div>
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground">
        If this is urgent, please include your business name in the message.
      </div>
    </div>
  );
}
