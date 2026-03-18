
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { removeMember } from "@/services/users";
import { toast } from "@/hooks/use-toast";

export function useRemoveMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { classroomId: string; memberId: string }) =>
      removeMember(data.classroomId, data.memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["managedUsers"] });
      queryClient.invalidateQueries({ queryKey: ["managedUsersStats"] });
      toast({ title: "Success", description: "Member has been removed." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}
