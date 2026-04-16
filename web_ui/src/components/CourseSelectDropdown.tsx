import { useState, useRef, useCallback, useEffect } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { fetchCourses, type Course } from '@/services/courses';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronDown, Loader2, Search, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CourseSelectDropdownProps {
    value?: string;
    onChange: (value: string, course?: Course | null) => void;
    placeholder?: string;
    className?: string;
    semesterId?: string;
    allowAll?: boolean;
    returnValue?: 'codeOrId' | 'id';
    selectedLabel?: string;
}

export function CourseSelectDropdown({
    value,
    onChange,
    placeholder = 'Select course',
    className,
    semesterId,
    allowAll = false,
    returnValue = 'codeOrId',
    selectedLabel,
}: CourseSelectDropdownProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const observerRef = useRef<IntersectionObserver | null>(null);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search.trim()), 250);
        return () => clearTimeout(timer);
    }, [search]);

    const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isPending, isError } = useInfiniteQuery({
        queryKey: ['courses-dropdown', debouncedSearch, semesterId, value],
        queryFn: ({ pageParam = 1 }) =>
            fetchCourses({
                page: pageParam as number,
                limit: 20,
                search: debouncedSearch || undefined,
                semesterId,
            }),
        getNextPageParam: (lastPage) => {
            if (lastPage.meta.page < lastPage.meta.lastPage) {
                return lastPage.meta.page + 1;
            }
            return undefined;
        },
        initialPageParam: 1,
        enabled: open || !!value, // Fetch selected option label even before opening
    });

    const courses = data?.pages.flatMap((page) => page.data) ?? [];

    // Find selected course
    const selectedCourse = courses.find((c) => c.id === value || c.code === value);
    const selectedCourseLabel = selectedCourse
        ? selectedCourse.code
            ? `${selectedCourse.code} - ${selectedCourse.name}`
            : selectedCourse.name
        : selectedLabel;

    // Infinite scroll observer
    const lastElementRef = useCallback(
        (node: HTMLButtonElement | null) => {
            if (isFetchingNextPage) return;
            if (observerRef.current) observerRef.current.disconnect();

            observerRef.current = new IntersectionObserver((entries) => {
                if (entries[0].isIntersecting && hasNextPage) {
                    fetchNextPage();
                }
            });

            if (node) observerRef.current.observe(node);
        },
        [hasNextPage, isFetchingNextPage, fetchNextPage],
    );

    // Reset search when closing
    useEffect(() => {
        if (!open) {
            setSearch('');
        }
    }, [open]);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn('h-8 w-full max-w-full min-w-0 justify-between gap-2 overflow-hidden text-xs', className)}
                >
                    {value === 'all' ? (
                        <span className="truncate">All Courses</span>
                    ) : selectedCourseLabel ? (
                        <span className="truncate">{selectedCourseLabel}</span>
                    ) : (
                        <span className="text-muted-foreground truncate">{placeholder}</span>
                    )}
                    <ChevronDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[240px] p-0" align="start">
                <div className="p-2 border-b border-border">
                    <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                        <Input
                            placeholder="Search..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="h-7 pl-7 text-xs"
                        />
                    </div>
                </div>
                <ScrollArea className="h-[200px]">
                    <div className="p-1">
                        {/* All Courses option */}
                        {allowAll && (
                            <button
                                onClick={() => {
                                    onChange('all', null);
                                    setOpen(false);
                                }}
                                className={cn(
                                    'w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent flex items-center gap-2',
                                    value === 'all' && 'bg-accent',
                                )}
                            >
                                <span className="font-bold">All Courses</span>
                            </button>
                        )}

                        {/* No Course option */}
                        {!allowAll && (
                            <button
                                onClick={() => {
                                    onChange('none', null);
                                    setOpen(false);
                                }}
                                className={cn(
                                    'w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent flex items-center gap-2',
                                    value === 'none' && 'bg-accent',
                                )}
                            >
                                <span className="text-muted-foreground">No Course</span>
                            </button>
                        )}

                        {isPending && open ? (
                            <div className="flex justify-center py-4">
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            </div>
                        ) : isError ? (
                            <div className="px-2 py-4 text-center text-xs text-destructive">
                                Error loading courses
                            </div>
                        ) : courses.length === 0 ? (
                            <div className="px-2 py-4 text-center text-xs text-muted-foreground">
                                No courses found
                            </div>
                        ) : (
                            <>
                                {courses.map((course, idx) => (
                                    <button
                                        key={course.id}
                                        ref={
                                            idx === courses.length - 1 ? lastElementRef : undefined
                                        }
                                        onClick={() => {
                                            const nextValue =
                                                returnValue === 'id'
                                                    ? course.id
                                                    : (course.code || course.id);
                                            onChange(nextValue, course);
                                            setOpen(false);
                                        }}
                                        className={cn(
                                            'w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent flex items-center gap-2',
                                            (value === course.id || value === course.code) &&
                                                'bg-accent',
                                        )}
                                    >
                                        <BookOpen className="h-3 w-3 text-muted-foreground shrink-0" />
                                        <span className="truncate">
                                            {course.code ? (
                                                <>
                                                    <span className="font-bold">{course.code}</span>
                                                    <span className="text-muted-foreground ml-1">
                                                        {course.name}
                                                    </span>
                                                </>
                                            ) : (
                                                course.name
                                            )}
                                        </span>
                                    </button>
                                ))}
                                {isFetchingNextPage && (
                                    <div className="flex justify-center py-2">
                                        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </ScrollArea>
            </PopoverContent>
        </Popover>
    );
}
