import { useState, useRef } from "react";
import { useProfile } from "@/hooks/use-profile";
import { useAuth } from "@/hooks/use-auth";
import { useStoreConnections } from "@/hooks/use-store-connection";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import { useToast } from "@/hooks/use-toast";
import { getInitials } from "@/lib/utils";
import { Loader2, Upload, Camera, User, UserCircle, Mail, Lock, AlertCircle } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const profileFormSchema = z.object({
  username: z.string().min(3, {
    message: "Username must be at least 3 characters.",
  }),
  email: z.string().email({
    message: "Please enter a valid email address.",
  }),
  fullName: z.string().min(2, {
    message: "Full name must be at least 2 characters.",
  }),
});

const passwordFormSchema = z.object({
  currentPassword: z.string().min(6, {
    message: "Current password is required.",
  }),
  newPassword: z.string().min(8, {
    message: "New password must be at least 8 characters.",
  }),
  confirmPassword: z.string(),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;
type PasswordFormValues = z.infer<typeof passwordFormSchema>;

export default function SettingsPage() {
  const { user } = useAuth();
  const { updateProfile, isUpdating } = useProfile();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("account");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState<string | null>(
    user?.profilePhoto || null
  );

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      username: user?.username || "",
      email: user?.email || "",
      fullName: user?.fullName || "",
    },
  });

  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  // Handle click on the upload button
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  // Handle file upload
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File",
        description: "Please select an image file.",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Please select an image smaller than 2MB.",
        variant: "destructive",
      });
      return;
    }

    // Create a preview
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setProfilePhotoPreview(result);
      
      // Update profile with the new photo
      updateProfile({ profilePhoto: result });
    };
    reader.readAsDataURL(file);
  };

  function onProfileSubmit(data: ProfileFormValues) {
    // Include the profile photo if it exists
    updateProfile({
      ...data,
      profilePhoto: profilePhotoPreview || undefined,
    });
  }

  function onPasswordSubmit(data: PasswordFormValues) {
    const { currentPassword, newPassword } = data;
    updateProfile({ currentPassword, newPassword });
    
    // Reset password form on successful submission
    passwordForm.reset({ 
      currentPassword: "", 
      newPassword: "", 
      confirmPassword: "" 
    });
  }

  // Get store connections and subscription data
  const {
    storeConnections,
    activeConnectionId,
    setActiveConnectionId,
    isLoading: storeConnectionsLoading,
  } = useStoreConnections();

  // Query for user subscription
  const { data: subscriptionData, isLoading: subscriptionLoading } = useQuery({
    queryKey: ["/api/user-subscription"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/user-subscription");
        return await res.json();
      } catch (error) {
        console.error("Failed to fetch subscription:", error);
        return {
          subscription: { tier: { name: "Free", maxOrders: 100 } },
          orderCount: 0,
        };
      }
    },
  });

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Calculate loading state
  const isLoading = storeConnectionsLoading || subscriptionLoading;

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="flex flex-col items-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="mt-4 text-sm text-muted-foreground">
            Loading settings...
          </p>
        </div>
      </div>
    );
  }

  // Process subscription data
  const subscription = subscriptionData || {
    subscription: { tier: { name: "Free", maxOrders: 100 } },
    orderCount: 0,
  };

  // Subscription info for sidebar
  const subscriptionInfo = {
    name: subscription.subscription?.tier?.name || "Free Plan",
    maxOrders: subscription.subscription?.tier?.maxOrders || 1000,
    currentOrders: subscription.orderCount || 0,
    percentUsed: subscription.orderCount
      ? (subscription.orderCount / subscription.subscription?.tier?.maxOrders) * 100
      : 0,
  };

  if (!user) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Alert className="w-96">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Authentication Required</AlertTitle>
          <AlertDescription>
            Please login to access your account settings.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-neutral-100">
      {/* Sidebar */}
      <div
        className={`${isMobileSidebarOpen ? "block" : "hidden"} md:block absolute md:relative z-10 h-full`}
      >
        <Sidebar
          storeConnections={storeConnections}
          activeConnectionId={activeConnectionId}
          onConnectionChange={setActiveConnectionId}
          subscriptionInfo={subscriptionInfo}
          onConnectStoreClick={() => {}} // Not needed for settings page
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          title="Settings"
          userName={user?.fullName || user?.username || "User"}
          userInitials={getInitials(user?.fullName || user?.username || "User")}
          onMobileMenuClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
        />

        <main className="flex-1 overflow-y-auto p-4">
          <div className="container mx-auto p-2">
            <div className="mb-8">
              <h1 className="text-3xl font-bold">Account Settings</h1>
              <p className="text-gray-500 mt-1">
                Manage your account information and password
              </p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 max-w-md">
                <TabsTrigger value="account" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Profile
                </TabsTrigger>
                <TabsTrigger value="security" className="flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Security
                </TabsTrigger>
              </TabsList>

              <TabsContent value="account" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Profile Information</CardTitle>
                    <CardDescription>
                      Update your account details and personal information
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {/* Profile Photo Upload */}
                    <div className="mb-8 flex flex-col items-center">
                      <div className="relative mb-4">
                        <Avatar className="h-32 w-32 border-4 border-white shadow-md">
                          <AvatarImage src={profilePhotoPreview || undefined} alt={user?.fullName || user?.username || "User"} />
                          <AvatarFallback className="text-3xl bg-primary text-primary-foreground">
                            {getInitials(user?.fullName || user?.username || "User")}
                          </AvatarFallback>
                        </Avatar>
                        <Button 
                          size="icon" 
                          variant="secondary" 
                          className="absolute -right-2 -bottom-2 h-8 w-8 rounded-full shadow-md"
                          onClick={handleUploadClick}
                          type="button"
                        >
                          <Camera className="h-4 w-4" />
                        </Button>
                      </div>
                      <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={handleFileChange}
                      />
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={handleUploadClick}
                        type="button"
                        className="flex items-center gap-2"
                      >
                        <Upload className="h-4 w-4" />
                        Change Photo
                      </Button>
                      <p className="mt-2 text-xs text-muted-foreground">
                        JPEG or PNG, max 2MB
                      </p>
                    </div>

                    <Form {...profileForm}>
                      <form
                        onSubmit={profileForm.handleSubmit(onProfileSubmit)}
                        className="space-y-6"
                      >
                        <FormField
                          control={profileForm.control}
                          name="username"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Username</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <UserCircle className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                                  <Input 
                                    className="pl-10" 
                                    placeholder="Your username" 
                                    {...field} 
                                  />
                                </div>
                              </FormControl>
                              <FormDescription>
                                This is your public display name.
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={profileForm.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                                  <Input 
                                    className="pl-10" 
                                    placeholder="Your email address" 
                                    {...field} 
                                  />
                                </div>
                              </FormControl>
                              <FormDescription>
                                We'll use this email to contact you.
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={profileForm.control}
                          name="fullName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Full Name</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <User className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                                  <Input 
                                    className="pl-10" 
                                    placeholder="Your full name" 
                                    {...field} 
                                  />
                                </div>
                              </FormControl>
                              <FormDescription>
                                Your full name helps us personalize your experience.
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <Button 
                          type="submit" 
                          className="w-full md:w-auto" 
                          disabled={isUpdating}
                        >
                          {isUpdating ? "Updating..." : "Update Profile"}
                        </Button>
                      </form>
                    </Form>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="security" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Password</CardTitle>
                    <CardDescription>
                      Change your password to keep your account secure
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Form {...passwordForm}>
                      <form
                        onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}
                        className="space-y-6"
                      >
                        <FormField
                          control={passwordForm.control}
                          name="currentPassword"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Current Password</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                                  <Input 
                                    className="pl-10" 
                                    type="password" 
                                    placeholder="Your current password" 
                                    {...field} 
                                  />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={passwordForm.control}
                          name="newPassword"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>New Password</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                                  <Input 
                                    className="pl-10" 
                                    type="password" 
                                    placeholder="Your new password" 
                                    {...field} 
                                  />
                                </div>
                              </FormControl>
                              <FormDescription>
                                Must be at least 8 characters long.
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={passwordForm.control}
                          name="confirmPassword"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Confirm New Password</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                                  <Input 
                                    className="pl-10" 
                                    type="password" 
                                    placeholder="Confirm your new password" 
                                    {...field} 
                                  />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <Button 
                          type="submit" 
                          className="w-full md:w-auto" 
                          disabled={isUpdating}
                        >
                          {isUpdating ? "Updating..." : "Change Password"}
                        </Button>
                      </form>
                    </Form>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
}