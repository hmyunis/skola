
import { useQuery, useMutation } from "@tanstack/react-query";
import { validateInviteCode, registerWithInvite } from "@/services/invites";

export function useValidateInviteCode(code: string) {
  return useQuery({
    queryKey: ["invite", code],
    queryFn: () => validateInviteCode(code),
    enabled: !!code,
    retry: false,
  });
}

export function useRegisterWithInvite() {
  return useMutation({
    mutationFn: (data: {
      code: string;
      fullName: string;
      telegramUsername?: string;
    }) => registerWithInvite(data.code, data.fullName, data.telegramUsername),
  });
}
