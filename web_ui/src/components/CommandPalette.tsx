import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  Calendar,
  BookOpen,
  FolderOpen,
  MessageSquare,
  Swords,
  Settings,
  Users,
  Megaphone,
  ShieldAlert,
  GraduationCap,
  BarChart3,
  ToggleLeft,
  Download,
  Search,
  Loader2,
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useClassroomStore } from "@/stores/classroomStore";
import { searchCommandPalette } from "@/services/search";

interface PageCommand {
  title: string;
  url: string;
  icon: typeof Search;
  group: "pages" | "admin" | "owner";
  featureId?: string;
  keywords?: string;
}

const pages: PageCommand[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, group: "pages", keywords: "home overview" },
  { title: "Schedule", url: "/schedule", icon: Calendar, group: "pages", featureId: "ft-schedule", keywords: "classes timetable routine" },
  { title: "Assessments", url: "/academics", icon: BookOpen, group: "pages", featureId: "ft-academics", keywords: "assignments exams quizzes academics" },
  { title: "Resources", url: "/resources", icon: FolderOpen, group: "pages", featureId: "ft-resources", keywords: "files notes slides documents" },
  { title: "Lounge", url: "/lounge", icon: MessageSquare, group: "pages", featureId: "ft-lounge", keywords: "posts discussion chat" },
  { title: "Arena", url: "/arena", icon: Swords, group: "pages", featureId: "ft-arena", keywords: "quiz battle leaderboard" },
  { title: "Announcements", url: "/announcements", icon: Megaphone, group: "pages", featureId: "ft-announcements", keywords: "news alerts notices" },
  { title: "Members", url: "/members", icon: Users, group: "pages", featureId: "ft-members", keywords: "people users classmates" },
  { title: "Settings", url: "/settings", icon: Settings, group: "pages", featureId: "ft-appearance", keywords: "theme appearance notifications preferences" },
];

const adminPages: PageCommand[] = [
  { title: "Admin: Users", url: "/admin/users", icon: Users, group: "admin", keywords: "manage users roles status" },
  { title: "Admin: Moderation", url: "/admin/moderation", icon: ShieldAlert, group: "admin", keywords: "reports moderation abuse" },
  { title: "Admin: Announcements", url: "/admin/announcements", icon: Megaphone, group: "admin", keywords: "publish announcement broadcast" },
];

const ownerPages: PageCommand[] = [
  { title: "Owner: Courses", url: "/admin/courses", icon: GraduationCap, group: "owner", keywords: "manage courses catalog" },
  { title: "Owner: Analytics", url: "/owner/analytics", icon: BarChart3, group: "owner", keywords: "metrics insights engagement" },
  { title: "Owner: Features", url: "/owner/features", icon: ToggleLeft, group: "owner", keywords: "feature toggles configuration" },
  { title: "Owner: Data Export", url: "/owner/general?tab=export", icon: Download, group: "owner", keywords: "export backup download data" },
  { title: "Owner: General", url: "/owner/general", icon: Settings, group: "owner", keywords: "owner settings invites semesters" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const navigate = useNavigate();
  const { isAdmin, isOwner } = useAuthStore();
  const activeClassroom = useClassroomStore((s) => s.activeClassroom);
  const features = activeClassroom?.featureToggles || [];

  const featureEnabledById = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const feature of features as Array<{ id?: string; enabled?: boolean }>) {
      if (!feature?.id) continue;
      map.set(feature.id, !!feature.enabled);
    }
    return map;
  }, [features]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchValue.trim()), 220);
    return () => clearTimeout(timer);
  }, [searchValue]);

  useEffect(() => {
    if (!open) {
      setSearchValue("");
      setDebouncedSearch("");
    }
  }, [open]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const allPages = useMemo(() => {
    const isFeatureEnabled = (featureId?: string) => {
      if (!featureId) return true;
      return featureEnabledById.get(featureId) ?? true;
    };

    let result = pages.filter((page) => isFeatureEnabled(page.featureId));
    if (isAdmin) result = [...result, ...adminPages];
    if (isOwner) result = [...result, ...ownerPages];
    return result;
  }, [isAdmin, isOwner, featureEnabledById]);

  const pageSearch = searchValue.trim().toLowerCase();
  const filteredPages = useMemo(() => {
    if (!pageSearch) return allPages;
    return allPages.filter((page) => {
      const haystack = `${page.title} ${page.keywords || ""}`.toLowerCase();
      return haystack.includes(pageSearch);
    });
  }, [allPages, pageSearch]);

  const shouldSearchServer = open && !!activeClassroom && debouncedSearch.length >= 2;

  const { data: serverSearch, isFetching: isSearching, isError: isSearchError } = useQuery({
    queryKey: ["commandPaletteSearch", activeClassroom?.id, debouncedSearch],
    queryFn: ({ signal }) =>
      searchCommandPalette(debouncedSearch, {
        limit: 5,
        signal,
      }),
    enabled: shouldSearchServer,
    staleTime: 30_000,
  });

  const visibleServerGroups = useMemo(() => {
    const isAcademicsEnabled = featureEnabledById.get("ft-academics") ?? true;
    const isResourcesEnabled = featureEnabledById.get("ft-resources") ?? true;
    const isArenaEnabled = featureEnabledById.get("ft-arena") ?? true;
    const isLoungeEnabled = featureEnabledById.get("ft-lounge") ?? true;
    const isMembersEnabled = featureEnabledById.get("ft-members") ?? true;

    const groups = serverSearch?.groups || {
      courses: [],
      assessments: [],
      resources: [],
      quizzes: [],
      posts: [],
      members: [],
    };

    return {
      courses: isAcademicsEnabled ? groups.courses : [],
      assessments: isAcademicsEnabled ? groups.assessments : [],
      resources: isResourcesEnabled ? groups.resources : [],
      quizzes: isArenaEnabled ? groups.quizzes : [],
      posts: isLoungeEnabled ? groups.posts : [],
      members: isMembersEnabled ? groups.members : [],
    };
  }, [serverSearch, featureEnabledById]);

  const hasServerResults =
    visibleServerGroups.courses.length > 0 ||
    visibleServerGroups.assessments.length > 0 ||
    visibleServerGroups.resources.length > 0 ||
    visibleServerGroups.quizzes.length > 0 ||
    visibleServerGroups.posts.length > 0 ||
    visibleServerGroups.members.length > 0;

  const handleSelect = (url: string) => {
    setOpen(false);
    navigate(url);
  };

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-xs text-foreground bg-background/50 border border-border hover:border-muted-foreground/50 transition-colors"
      >
        <Search className="h-3 w-3" />
        <span>Search…</span>
        <kbd className="pointer-events-none ml-2 inline-flex h-5 items-center gap-0.5 border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          ⌘ K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          value={searchValue}
          onValueChange={setSearchValue}
          placeholder="Jump to pages or search classroom content..."
        />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>

          <CommandGroup heading="Pages">
            {filteredPages.map((page) => (
              <CommandItem
                key={page.url}
                value={`${page.title} ${page.keywords || ""}`}
                onSelect={() => handleSelect(page.url)}
                className="gap-2"
              >
                <page.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span>{page.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>

          {debouncedSearch.length >= 2 && (
            <>
              <CommandSeparator />

              {isSearching && (
                <CommandGroup heading="Classroom">
                  <CommandItem disabled forceMount value={`searching-${debouncedSearch}`} className="gap-2">
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                    <span>Searching...</span>
                  </CommandItem>
                </CommandGroup>
              )}

              {!isSearching && isSearchError && (
                <CommandGroup heading="Classroom">
                  <CommandItem disabled forceMount value={`search-error-${debouncedSearch}`} className="gap-2">
                    <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span>Search failed. Try again.</span>
                  </CommandItem>
                </CommandGroup>
              )}

              {!isSearching && !isSearchError && visibleServerGroups.courses.length > 0 && (
                <CommandGroup heading="Courses">
                  {visibleServerGroups.courses.map((item) => (
                    <CommandItem
                      key={`course-${item.id}`}
                      value={`course ${item.title} ${item.subtitle || ""}`}
                      onSelect={() => handleSelect(item.url)}
                      className="gap-2"
                    >
                      <GraduationCap className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{item.title}</span>
                      {item.subtitle && (
                        <span className="text-muted-foreground text-xs truncate">{item.subtitle}</span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {!isSearching && !isSearchError && visibleServerGroups.assessments.length > 0 && (
                <CommandGroup heading="Assessments">
                  {visibleServerGroups.assessments.map((item) => (
                    <CommandItem
                      key={`assessment-${item.id}`}
                      value={`assessment ${item.title} ${item.subtitle || ""}`}
                      onSelect={() => handleSelect(item.url)}
                      className="gap-2"
                    >
                      <BookOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{item.title}</span>
                      {item.subtitle && (
                        <span className="text-muted-foreground text-xs truncate">{item.subtitle}</span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {!isSearching && !isSearchError && visibleServerGroups.resources.length > 0 && (
                <CommandGroup heading="Resources">
                  {visibleServerGroups.resources.map((item) => (
                    <CommandItem
                      key={`resource-${item.id}`}
                      value={`resource ${item.title} ${item.subtitle || ""}`}
                      onSelect={() => handleSelect(item.url)}
                      className="gap-2"
                    >
                      <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{item.title}</span>
                      {item.subtitle && (
                        <span className="text-muted-foreground text-xs truncate">{item.subtitle}</span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {!isSearching && !isSearchError && visibleServerGroups.quizzes.length > 0 && (
                <CommandGroup heading="Arena Quizzes">
                  {visibleServerGroups.quizzes.map((item) => (
                    <CommandItem
                      key={`quiz-${item.id}`}
                      value={`quiz ${item.title} ${item.subtitle || ""}`}
                      onSelect={() => handleSelect(item.url)}
                      className="gap-2"
                    >
                      <Swords className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{item.title}</span>
                      {item.subtitle && (
                        <span className="text-muted-foreground text-xs truncate">{item.subtitle}</span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {!isSearching && !isSearchError && visibleServerGroups.posts.length > 0 && (
                <CommandGroup heading="Lounge Posts">
                  {visibleServerGroups.posts.map((item) => (
                    <CommandItem
                      key={`post-${item.id}`}
                      value={`post ${item.title} ${item.subtitle || ""}`}
                      onSelect={() => handleSelect(item.url)}
                      className="gap-2"
                    >
                      <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{item.title}</span>
                      {item.subtitle && (
                        <span className="text-muted-foreground text-xs truncate">{item.subtitle}</span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {!isSearching && !isSearchError && visibleServerGroups.members.length > 0 && (
                <CommandGroup heading="Members">
                  {visibleServerGroups.members.map((item) => (
                    <CommandItem
                      key={`member-${item.id}`}
                      value={`member ${item.title} ${item.subtitle || ""}`}
                      onSelect={() => handleSelect(item.url)}
                      className="gap-2"
                    >
                      <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{item.title}</span>
                      {item.subtitle && (
                        <span className="text-muted-foreground text-xs truncate">{item.subtitle}</span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {!isSearching && !isSearchError && !hasServerResults && (
                <CommandItem
                  disabled
                  forceMount
                  value={`no-classroom-results-${debouncedSearch}`}
                  className="gap-2"
                >
                  <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span>No classroom matches</span>
                </CommandItem>
              )}
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
