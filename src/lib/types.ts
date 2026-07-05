export type Role = "student" | "helper";
export type DocType = "essay" | "activity" | "recommender" | "extra" | "supplemental";
export type DocStatus = "draft" | "in_review" | "final";
export type TaskStatus = "todo" | "in_progress" | "done" | "missed";

export interface Profile {
  id: string;
  display_name: string;
  color: string;
  avatar_url: string | null;
  email: string | null;
}

export interface Workspace {
  id: string;
  name: string;
  student_id: string;
  created_at: string;
}

export interface Member {
  workspace_id: string;
  user_id: string;
  role: Role;
  joined_at: string;
  profile?: Profile;
}

/** Type-specific fields stored in documents.metadata */
export interface ActivityMeta {
  category?: string;
  position?: string; // leadership/position, ~50 char reference limit
  organization?: string;
  description?: string; // final description, ~150 char reference limit
  grades?: string[]; // ["9","10","11","12","PG"]
  hours_per_week?: number;
  weeks_per_year?: number;
  continue_in_college?: boolean;
  tags?: { label: string; color: string }[];
  checklist?: { label: string; done: boolean }[];
}

export interface RecommenderMeta {
  relationship?: string;
  email?: string;
  phone?: string;
  pipeline?: "not_asked" | "asked" | "confirmed" | "submitted";
}

export interface SupplementalMeta {
  school_id?: string; // workspace_schools.id
  question?: string;
  limit_value?: number;
  limit_unit?: "words" | "chars";
}

export interface Doc {
  id: string;
  workspace_id: string;
  type: DocType;
  title: string;
  current_content: any;
  status: DocStatus;
  metadata: ActivityMeta & RecommenderMeta & SupplementalMeta & Record<string, any>;
  sort_order: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface DocVersion {
  id: string;
  document_id: string;
  content: any;
  author_id: string;
  version_label: string | null;
  cover_image_url: string | null;
  word_count: number;
  created_at: string;
  deleted_at: string | null;
  author?: Profile;
}

export interface Comment {
  id: string;
  document_id: string;
  author_id: string;
  content: string;
  anchor: { from: number; to: number; quote?: string } | null;
  resolved: boolean;
  parent_id: string | null;
  mentions: string[];
  created_at: string;
  author?: Profile;
}

export interface Resource {
  id: string;
  workspace_id: string;
  document_id: string | null;
  type: "link" | "note" | "file";
  title: string;
  content: string | null;
  url: string | null;
  file_path: string | null;
  added_by: string;
  created_at: string;
}

export interface Task {
  id: string;
  workspace_id: string;
  title: string;
  task_type: string;
  assigned_to: string | null;
  assigned_by: string | null;
  due_date: string | null;
  estimated_minutes: number | null;
  status: TaskStatus;
  related_document_id: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface TaskRequest {
  id: string;
  workspace_id: string;
  from_user: string;
  to_user: string;
  title: string;
  task_type: string;
  due_date: string | null;
  estimated_minutes: number | null;
  note: string | null;
  status: "pending" | "accepted" | "declined";
  created_at: string;
}

export interface Message {
  id: string;
  workspace_id: string;
  sender_id: string;
  content: string;
  mentions: string[];
  created_at: string;
}

export interface Notification {
  id: string;
  workspace_id: string;
  user_id: string;
  kind: string;
  body: string;
  link: string | null;
  read: boolean;
  created_at: string;
}

export interface ActivityLogEntry {
  id: string;
  workspace_id: string;
  actor_id: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  summary: string;
  created_at: string;
}

export interface School {
  id: string;
  scorecard_id: string | null;
  name: string;
  city: string | null;
  state: string | null;
  ownership: string | null;
  admission_rate: number | null;
  enrollment: number | null;
  domain: string | null;
  url: string | null;
}

export interface WorkspaceSchool {
  id: string;
  workspace_id: string;
  school_id: string;
  status: "not_started" | "in_progress" | "complete";
  rd_deadline: string | null;
  ed_deadline: string | null;
  ea_deadline: string | null;
  notes: string | null;
  added_by: string;
  created_at: string;
  school?: School;
}

export const ACTIVITY_CATEGORIES = [
  "Academic",
  "Art",
  "Athletics: Club",
  "Athletics: JV/Varsity",
  "Career-Oriented",
  "Community Service (Volunteer)",
  "Computer/Technology",
  "Cultural",
  "Dance",
  "Debate/Speech",
  "Environmental",
  "Family Responsibilities",
  "Foreign Exchange",
  "Foreign Language",
  "Internship",
  "Journalism/Publication",
  "Junior R.O.T.C.",
  "LGBT",
  "Music: Instrumental",
  "Music: Vocal",
  "Religious",
  "Research",
  "Robotics",
  "School Spirit",
  "Science/Math",
  "Social Justice",
  "Student Govt./Politics",
  "Theater/Drama",
  "Work (Paid)",
  "Other Club/Activity",
] as const;

export const GRADE_LEVELS = ["9", "10", "11", "12", "PG"] as const;

export const TAG_COLORS = [
  "#175E54",
  "#D9A514",
  "#A33B34",
  "#3E5C8A",
  "#7A4A8A",
  "#B06A2E",
] as const;

export const MEMBER_COLORS = [
  "#175E54",
  "#3E5C8A",
  "#A33B34",
  "#7A4A8A",
  "#B06A2E",
  "#2F6B3A",
  "#8A3E62",
  "#4A6B7A",
] as const;
