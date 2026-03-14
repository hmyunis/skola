import { useQuery } from "@tanstack/react-query";
import { fetchClassroom } from "@/services/api";
import { useClassroomStore } from "@/stores/classroomStore";
import { useAuthStore } from "@/stores/authStore";
import { useEffect } from "react";

export function useSyncClassroom() {
  const { activeClassroom, setActiveClassroom } = useClassroomStore();
  const { user } = useAuthStore();

  const { data: classroom, error } = useQuery({
    queryKey: ["classroom", activeClassroom?.id],
    queryFn: () => fetchClassroom(activeClassroom!.id),
    enabled: !!activeClassroom?.id && !!user,
    // Smart refetching: on mount, on focus, and if data is stale
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (classroom && activeClassroom) {
      // Check if features have changed to avoid unnecessary store updates
      const currentFeatures = JSON.stringify(activeClassroom.featureToggles);
      const newFeatures = JSON.stringify(classroom.featureToggles);
      
      if (currentFeatures !== newFeatures) {
        setActiveClassroom(classroom);
      }
    }
  }, [classroom, activeClassroom, setActiveClassroom]);

  return { classroom, error };
}
