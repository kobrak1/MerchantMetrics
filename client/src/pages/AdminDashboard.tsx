import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";

// UI Components
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, 
  UserCog, 
  Store, 
  Users, 
  Package, 
  BarChart, 
  PlusCircle, 
  Trash2 
} from "lucide-react";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

type User = {
  id: number;
  username: string;
  email: string;
  fullName: string | null;
  isAdmin: boolean;
  lastLoginAt: string | null;
  createdAt: string | null;
  sessionCount: number;
};

type StoreConnection = {
  id: number;
  name: string;
  platform: string;
  storeUrl: string;
  isActive: boolean;
  lastSyncAt: string | null;
  totalApiRequests: number;
  totalOrdersProcessed: number;
  createdAt: string | null;
};

type UserSubscription = {
  id: number;
  tierId: number;
  startDate: string;
  endDate: string | null;
  isActive: boolean;
  isTrial: boolean;
};

type UserDetails = {
  user: User;
  storeConnections: StoreConnection[];
  subscription: UserSubscription | null;
};

// Define form schema for adding a new user
const newUserFormSchema = z.object({
  username: z
    .string()
    .min(3, { message: "Username must be at least 3 characters" })
    .max(50, { message: "Username cannot exceed 50 characters" }),
  email: z
    .string()
    .email({ message: "Please enter a valid email address" }),
  password: z
    .string()
    .min(6, { message: "Password must be at least 6 characters" }),
  fullName: z
    .string()
    .min(2, { message: "Full name must be at least 2 characters" })
    .max(100, { message: "Full name cannot exceed 100 characters" }),
  isAdmin: z.boolean().default(false),
});

type NewUserFormValues = z.infer<typeof newUserFormSchema>;

const AdminDashboard = () => {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Form for adding a new user
  const form = useForm<NewUserFormValues>({
    resolver: zodResolver(newUserFormSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      fullName: "",
      isAdmin: false,
    },
  });

  // Query to fetch all users
  const {
    data: users,
    isLoading: isLoadingUsers,
    error: usersError,
  } = useQuery({
    queryKey: ["/api/admin/users"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/users");
      const data = await response.json();
      return data.users as User[];
    },
    enabled: !isLoading && !!user?.isAdmin,
  });

  // Query to fetch selected user details
  const {
    data: userDetails,
    isLoading: isLoadingUserDetails,
    error: userDetailsError,
  } = useQuery({
    queryKey: ["/api/admin/users", selectedUserId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/admin/users/${selectedUserId}`);
      const data = await response.json();
      return data as UserDetails;
    },
    enabled: !!selectedUserId && isUserModalOpen,
  });

  // Mutation to update user
  const updateUserMutation = useMutation({
    mutationFn: async ({
      userId,
      data,
    }: {
      userId: number;
      data: Partial<User>;
    }) => {
      const response = await apiRequest("PATCH", `/api/admin/users/${userId}`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "User updated",
        description: "User information has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users", selectedUserId] });
    },
    onError: (error) => {
      toast({
        title: "Update failed",
        description: "Failed to update user: " + error.message,
        variant: "destructive",
      });
    },
  });
  
  // Mutation to add a new user
  const addUserMutation = useMutation({
    mutationFn: async (userData: NewUserFormValues) => {
      const response = await apiRequest("POST", "/api/admin/users", userData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "User created",
        description: "New user has been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setIsAddUserDialogOpen(false);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: "User creation failed",
        description: "Failed to create user: " + error.message,
        variant: "destructive",
      });
    },
  });
  
  // Mutation to delete a user
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await apiRequest("DELETE", `/api/admin/users/${userId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "User deleted",
        description: "User has been deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setIsDeleteDialogOpen(false);
      setUserToDelete(null);
    },
    onError: (error) => {
      toast({
        title: "Deletion failed",
        description: "Failed to delete user: " + error.message,
        variant: "destructive",
      });
    },
  });

  const handleViewUser = (userId: number) => {
    setSelectedUserId(userId);
    setIsUserModalOpen(true);
  };

  const handleToggleAdmin = (userId: number, currentIsAdmin: boolean) => {
    updateUserMutation.mutate({
      userId,
      data: { isAdmin: !currentIsAdmin },
    });
  };
  
  const handleAddUser = async (data: NewUserFormValues) => {
    addUserMutation.mutate(data);
  };
  
  const handleDeleteUser = (userId: number) => {
    deleteUserMutation.mutate(userId);
  };

  const confirmDeleteUser = (userToDelete: User) => {
    setUserToDelete(userToDelete);
    setIsDeleteDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container p-4 mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          Manage users, subscriptions, and system settings
        </p>
      </header>

      <Tabs defaultValue="users" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            <span>Users</span>
          </TabsTrigger>
          <TabsTrigger value="stores" className="flex items-center gap-2">
            <Store className="w-4 h-4" />
            <span>Stores</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart className="w-4 h-4" />
            <span>Analytics</span>
          </TabsTrigger>
          <TabsTrigger value="system" className="flex items-center gap-2">
            <UserCog className="w-4 h-4" />
            <span>System</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>User Management</CardTitle>
              <CardDescription>
                View and manage user accounts and permissions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingUsers ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : usersError ? (
                <div className="p-4 text-center text-red-500">
                  Error loading users: {(usersError as Error).message}
                </div>
              ) : (
                <>
                  <div className="mb-4 flex justify-end">
                    <Button 
                      onClick={() => setIsAddUserDialogOpen(true)}
                      className="flex items-center gap-1"
                    >
                      <PlusCircle className="h-4 w-4" />
                      <span>Add User</span>
                    </Button>
                  </div>
                  <Table>
                    <TableCaption>List of all registered users in the system</TableCaption>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Username</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Created At</TableHead>
                        <TableHead>Admin</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users?.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>{user.id}</TableCell>
                          <TableCell>{user.username}</TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>{user.fullName || "-"}</TableCell>
                          <TableCell>
                            {user.createdAt
                              ? new Date(user.createdAt).toLocaleDateString()
                              : "-"}
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={user.isAdmin}
                              onCheckedChange={() => 
                                handleToggleAdmin(user.id, user.isAdmin)
                              }
                            />
                          </TableCell>
                          <TableCell className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewUser(user.id)}
                            >
                              View Details
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => confirmDeleteUser(user)}
                              disabled={user.id === 1} // Prevent deleting the main admin
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stores">
          <Card>
            <CardHeader>
              <CardTitle>Store Connections</CardTitle>
              <CardDescription>
                Manage e-commerce store connections
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p>Store management tools will be implemented in a future update.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <Card>
            <CardHeader>
              <CardTitle>System Analytics</CardTitle>
              <CardDescription>View system-wide analytics and usage statistics</CardDescription>
            </CardHeader>
            <CardContent>
              <p>System analytics will be implemented in a future update.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system">
          <Card>
            <CardHeader>
              <CardTitle>System Settings</CardTitle>
              <CardDescription>Manage system-wide configuration</CardDescription>
            </CardHeader>
            <CardContent>
              <p>System settings will be implemented in a future update.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* User Details Modal */}
      <Dialog open={isUserModalOpen} onOpenChange={setIsUserModalOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
            <DialogDescription>
              View and manage detailed user information
            </DialogDescription>
          </DialogHeader>

          {isLoadingUserDetails ? (
            <div className="space-y-4 py-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : userDetailsError ? (
            <div className="p-4 text-center text-red-500">
              Error loading user details: {(userDetailsError as Error).message}
            </div>
          ) : userDetails ? (
            <div className="grid gap-6">
              <div className="grid gap-4">
                <h3 className="text-lg font-semibold">Basic Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      value={userDetails.user.username}
                      disabled
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      value={userDetails.user.email}
                      disabled
                    />
                  </div>
                  <div>
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input
                      id="fullName"
                      value={userDetails.user.fullName || ""}
                      disabled
                    />
                  </div>
                  <div>
                    <Label htmlFor="createdAt">Created At</Label>
                    <Input
                      id="createdAt"
                      value={
                        userDetails.user.createdAt
                          ? new Date(
                              userDetails.user.createdAt
                            ).toLocaleString()
                          : "-"
                      }
                      disabled
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastLogin">Last Login</Label>
                    <Input
                      id="lastLogin"
                      value={
                        userDetails.user.lastLoginAt
                          ? new Date(
                              userDetails.user.lastLoginAt
                            ).toLocaleString()
                          : "Never"
                      }
                      disabled
                    />
                  </div>
                  <div>
                    <Label htmlFor="sessionCount">Session Count</Label>
                    <Input
                      id="sessionCount"
                      value={userDetails.user.sessionCount.toString()}
                      disabled
                    />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-4">Subscription</h3>
                {userDetails.subscription ? (
                  <div className="p-4 border rounded">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium">Tier ID:</span>
                      <span>{userDetails.subscription.tierId}</span>
                    </div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium">Status:</span>
                      <Badge variant={userDetails.subscription.isActive ? "default" : "secondary"}>
                        {userDetails.subscription.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium">Trial:</span>
                      <Badge variant={userDetails.subscription.isTrial ? "outline" : "secondary"}>
                        {userDetails.subscription.isTrial ? "Trial" : "Regular"}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium">Started:</span>
                      <span>
                        {new Date(
                          userDetails.subscription.startDate
                        ).toLocaleDateString()}
                      </span>
                    </div>
                    {userDetails.subscription.endDate && (
                      <div className="flex justify-between items-center">
                        <span className="font-medium">Ends:</span>
                        <span>
                          {new Date(
                            userDetails.subscription.endDate
                          ).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No subscription found</p>
                )}
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-4">Store Connections</h3>
                {userDetails.storeConnections.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Platform</TableHead>
                        <TableHead>URL</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>API Requests</TableHead>
                        <TableHead>Orders</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {userDetails.storeConnections.map((connection) => (
                        <TableRow key={connection.id}>
                          <TableCell>{connection.name}</TableCell>
                          <TableCell className="capitalize">
                            {connection.platform}
                          </TableCell>
                          <TableCell>{connection.storeUrl}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                connection.isActive ? "default" : "secondary"
                              }
                            >
                              {connection.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell>{connection.totalApiRequests}</TableCell>
                          <TableCell>{connection.totalOrdersProcessed}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-muted-foreground">No store connections found</p>
                )}
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button onClick={() => setIsUserModalOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add User Dialog */}
      <Dialog open={isAddUserDialogOpen} onOpenChange={setIsAddUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>
              Create a new user account with the following information.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleAddUser)} className="space-y-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input placeholder="username" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="user@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isAdmin"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Admin Privileges</FormLabel>
                      <FormDescription>
                        Grant admin dashboard access to this user
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsAddUserDialogOpen(false);
                    form.reset();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={addUserMutation.isPending}>
                  {addUserMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Create User
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the user
              account for {userToDelete?.username} and remove all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setUserToDelete(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => userToDelete && handleDeleteUser(userToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteUserMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminDashboard;