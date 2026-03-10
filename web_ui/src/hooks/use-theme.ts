
import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/services/api";
import { toast } from "@/hooks/use-toast";
import { useAuthStore } from "@/stores/authStore";
import { useClassroomStore } from "@/stores/classroomStore";

export function useUpdateUserTheme() {
  return useMutation({
    mutationFn: (themeSettings: any) =>
      apiFetch("/users/me/theme", {
        method: "PUT",
        body: JSON.stringify(themeSettings),
      }),
    onMutate: async () => {
      toast({ title: "Updating Theme", description: "Please wait..." });
    },
    onSuccess: (updatedUser) => {
      useAuthStore.getState().setUser(updatedUser);
      toast({ title: "Success", description: "Your theme settings have been updated." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useUpdateClassroomTheme() {
  return useMutation({
    mutationFn: (data: { classroomId: string; theme: any }) =>
      apiFetch(`/classrooms/${data.classroomId}/theme`, {
        method: "PUT",
        body: JSON.stringify(data.theme),
      }),
    onMutate: async () => {
      toast({ title: "Updating Classroom Theme", description: "Please wait..." });
    },
    onSuccess: (updatedClassroom) => {
      useClassroomStore.getState().setActiveClassroom(updatedClassroom);
      toast({ title: "Success", description: "The classroom theme has been updated." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}
