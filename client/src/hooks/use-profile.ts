import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "./use-auth";
import { useToast } from "./use-toast";

interface ProfileUpdateData {
  username?: string;
  email?: string;
  fullName?: string;
  currentPassword?: string;
  newPassword?: string;
}

export function useProfile() {
  const { user } = useAuth();
  const { toast } = useToast();

  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileUpdateData) => {
      const res = await apiRequest("PATCH", "/api/user/profile", data);
      const result = await res.json();
      
      if (!result.success) {
        throw new Error(result.message || "Failed to update profile");
      }
      
      return result.user;
    },
    onSuccess: (updatedUser) => {
      // Update the user in the cache
      queryClient.setQueryData(["/api/user"], {
        success: true,
        user: updatedUser
      });
      
      toast({
        title: "Profile Updated",
        description: "Your profile has been successfully updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update your profile. Please try again.",
        variant: "destructive",
      });
    },
  });

  return {
    user,
    updateProfile: updateProfileMutation.mutate,
    isUpdating: updateProfileMutation.isPending,
    error: updateProfileMutation.error,
  };
}