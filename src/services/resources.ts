const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type ResourceType = "pdf" | "slides" | "notes" | "video" | "code" | "link";
export type ResourceCategory = "lecture" | "lab" | "reference" | "exam-prep" | "project";

export interface Resource {
  id: string;
  title: string;
  course: string;
  type: ResourceType;
  category: ResourceCategory;
  uploadedBy: string;
  uploadedAt: string;
  size: string;
  rating: number;
  totalRatings: number;
  upvotes: number;
  downvotes: number;
  description: string;
  tags: string[];
}

export const RESOURCE_TYPES: { value: ResourceType; label: string }[] = [
  { value: "pdf", label: "PDF" },
  { value: "slides", label: "Slides" },
  { value: "notes", label: "Notes" },
  { value: "video", label: "Video" },
  { value: "code", label: "Code" },
  { value: "link", label: "Link" },
];

export const RESOURCE_CATEGORIES: { value: ResourceCategory; label: string }[] = [
  { value: "lecture", label: "Lecture Material" },
  { value: "lab", label: "Lab Resources" },
  { value: "reference", label: "Reference" },
  { value: "exam-prep", label: "Exam Prep" },
  { value: "project", label: "Project" },
];

export async function fetchResources(): Promise<Resource[]> {
  await delay(350);
  return [
    {
      id: "r1",
      title: "Binary Trees — Complete Notes",
      course: "CS301",
      type: "pdf",
      category: "lecture",
      uploadedBy: "Prof. Tigist",
      uploadedAt: "2026-02-28",
      size: "2.4 MB",
      rating: 4.7,
      totalRatings: 23,
      upvotes: 31,
      downvotes: 2,
      description: "Comprehensive notes covering binary trees, BST, AVL trees, and B-trees with diagrams and complexity analysis.",
      tags: ["trees", "bst", "avl", "data-structures"],
    },
    {
      id: "r2",
      title: "DBMS ER Diagram Tutorial Slides",
      course: "CS302",
      type: "slides",
      category: "lecture",
      uploadedBy: "Prof. Mehta",
      uploadedAt: "2026-03-01",
      size: "5.1 MB",
      rating: 4.2,
      totalRatings: 15,
      upvotes: 18,
      downvotes: 3,
      description: "Slide deck covering ER diagrams, relationships, cardinality, and mapping to relational schemas.",
      tags: ["er-diagram", "database", "schema"],
    },
    {
      id: "r3",
      title: "TCP/IP Protocol Stack — Lab Manual",
      course: "CS303",
      type: "pdf",
      category: "lab",
      uploadedBy: "Lab TA",
      uploadedAt: "2026-02-20",
      size: "1.8 MB",
      rating: 3.9,
      totalRatings: 12,
      upvotes: 14,
      downvotes: 4,
      description: "Lab manual covering TCP/IP socket programming, Wireshark captures, and packet analysis exercises.",
      tags: ["tcp", "ip", "wireshark", "sockets"],
    },
    {
      id: "r4",
      title: "OS Process Scheduling Simulator",
      course: "CS304",
      type: "code",
      category: "project",
      uploadedBy: "Arjun K.",
      uploadedAt: "2026-03-03",
      size: "340 KB",
      rating: 4.8,
      totalRatings: 8,
      upvotes: 22,
      downvotes: 0,
      description: "Python-based simulator for FCFS, SJF, Round Robin, and Priority scheduling algorithms with Gantt chart output.",
      tags: ["scheduling", "fcfs", "sjf", "python"],
    },
    {
      id: "r5",
      title: "DSA Mid-Sem Previous Year Papers",
      course: "CS301",
      type: "pdf",
      category: "exam-prep",
      uploadedBy: "Priya S.",
      uploadedAt: "2026-03-05",
      size: "4.2 MB",
      rating: 4.9,
      totalRatings: 34,
      upvotes: 45,
      downvotes: 1,
      description: "Collection of 5 previous year mid-semester papers with solutions for Data Structures & Algorithms.",
      tags: ["previous-year", "mid-sem", "solutions"],
    },
    {
      id: "r6",
      title: "Normalization Video Lecture (3NF, BCNF)",
      course: "CS302",
      type: "video",
      category: "lecture",
      uploadedBy: "Prof. Mehta",
      uploadedAt: "2026-02-25",
      size: "180 MB",
      rating: 4.5,
      totalRatings: 19,
      upvotes: 26,
      downvotes: 2,
      description: "Recorded lecture covering functional dependencies, 1NF through BCNF normalization with worked examples.",
      tags: ["normalization", "3nf", "bcnf", "functional-dependencies"],
    },
    {
      id: "r7",
      title: "Subnetting Cheat Sheet",
      course: "CS303",
      type: "notes",
      category: "reference",
      uploadedBy: "Ravi M.",
      uploadedAt: "2026-03-02",
      size: "120 KB",
      rating: 4.6,
      totalRatings: 28,
      upvotes: 38,
      downvotes: 1,
      description: "Quick reference for subnet masks, CIDR notation, and IP address class ranges with practice problems.",
      tags: ["subnetting", "cidr", "ip-addressing"],
    },
    {
      id: "r8",
      title: "Deadlock Detection Algorithm — Walkthrough",
      course: "CS304",
      type: "notes",
      category: "exam-prep",
      uploadedBy: "Sneha R.",
      uploadedAt: "2026-03-06",
      size: "280 KB",
      rating: 4.3,
      totalRatings: 11,
      upvotes: 15,
      downvotes: 2,
      description: "Step-by-step walkthrough of Banker's algorithm and deadlock detection using resource allocation graphs.",
      tags: ["deadlock", "bankers-algorithm", "rag"],
    },
    {
      id: "r9",
      title: "Graph Algorithms Visualizer",
      course: "CS301",
      type: "link",
      category: "reference",
      uploadedBy: "Karan P.",
      uploadedAt: "2026-03-04",
      size: "—",
      rating: 4.4,
      totalRatings: 16,
      upvotes: 20,
      downvotes: 3,
      description: "Interactive web tool for visualizing BFS, DFS, Dijkstra's, and Kruskal's algorithms on custom graphs.",
      tags: ["graphs", "bfs", "dfs", "dijkstra", "visualization"],
    },
    {
      id: "r10",
      title: "SQL Joins — Practice Problem Set",
      course: "CS302",
      type: "pdf",
      category: "lab",
      uploadedBy: "Lab TA",
      uploadedAt: "2026-03-07",
      size: "950 KB",
      rating: 4.1,
      totalRatings: 9,
      upvotes: 12,
      downvotes: 1,
      description: "30 practice problems on SQL joins (INNER, LEFT, RIGHT, FULL) with expected output tables and solutions.",
      tags: ["sql", "joins", "practice"],
    },
  ];
}
