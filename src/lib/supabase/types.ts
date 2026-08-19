export type StartupStatus = "new" | "in_review" | "passed" | "investing";
export type UserRole = "analyst" | "admin";
export type SignupRequestStatus = "pending" | "approved" | "rejected";
export type DocumentType = "deck" | "comment";
export type CommentAudience = "evidence" | "discussion";
export type EnrichmentSource = "web_search";
export type Verdict =
  | "Strong yes"
  | "Promising"
  | "Needs diligence"
  | "Weak fit"
  | "Pass"
  | "No live opportunity";

export interface ReviewPoint {
  point: string;
  evidence: string;
}

export interface Contradiction {
  point: string;
  deck_says: string;
  call_says: string;
}

export interface KeyFinding {
  point: string;
  source_name: string;
  url: string;
}

export interface Database {
  public: {
    Tables: {
      teams: {
        Row: {
          id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      users: {
        Row: {
          id: string;
          team_id: string;
          name: string;
          role: UserRole;
          tour_completed: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          team_id: string;
          name: string;
          role?: UserRole;
          tour_completed?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          team_id?: string;
          name?: string;
          role?: UserRole;
          tour_completed?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "users_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      startups: {
        Row: {
          id: string;
          team_id: string;
          name: string;
          domain: string | null;
          sector: string | null;
          stage: string | null;
          ask_amount: number | null;
          founder_names: string | null;
          status: StartupStatus;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          name: string;
          domain?: string | null;
          sector?: string | null;
          stage?: string | null;
          ask_amount?: number | null;
          founder_names?: string | null;
          status?: StartupStatus;
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          team_id?: string;
          name?: string;
          domain?: string | null;
          sector?: string | null;
          stage?: string | null;
          ask_amount?: number | null;
          founder_names?: string | null;
          status?: StartupStatus;
          created_by?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "startups_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "startups_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      documents: {
        Row: {
          id: string;
          startup_id: string;
          type: DocumentType;
          audience: CommentAudience | null;
          file_url: string | null;
          page_image_urls: string[];
          extracted_text: string | null;
          label: string | null;
          uploaded_by: string | null;
          uploaded_at: string;
        };
        Insert: {
          id?: string;
          startup_id: string;
          type: DocumentType;
          audience?: CommentAudience | null;
          file_url?: string | null;
          page_image_urls?: string[];
          extracted_text?: string | null;
          label?: string | null;
          uploaded_by: string;
          uploaded_at?: string;
        };
        Update: {
          id?: string;
          startup_id?: string;
          type?: DocumentType;
          audience?: CommentAudience | null;
          file_url?: string | null;
          page_image_urls?: string[];
          extracted_text?: string | null;
          label?: string | null;
          uploaded_by?: string;
          uploaded_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "documents_startup_id_fkey";
            columns: ["startup_id"];
            isOneToOne: false;
            referencedRelation: "startups";
            referencedColumns: ["id"];
          },
        ];
      };
      analyst_chat_messages: {
        Row: {
          id: string;
          startup_id: string;
          user_id: string;
          role: "user" | "assistant";
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          startup_id: string;
          user_id: string;
          role: "user" | "assistant";
          content: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          startup_id?: string;
          user_id?: string;
          role?: "user" | "assistant";
          content?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "analyst_chat_messages_startup_id_fkey";
            columns: ["startup_id"];
            isOneToOne: false;
            referencedRelation: "startups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "analyst_chat_messages_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      status_changes: {
        Row: {
          id: string;
          startup_id: string;
          from_status: string | null;
          to_status: string;
          changed_by: string | null;
          changed_at: string;
        };
        Insert: {
          id?: string;
          startup_id: string;
          from_status?: string | null;
          to_status: string;
          changed_by?: string | null;
          changed_at?: string;
        };
        Update: {
          id?: string;
          startup_id?: string;
          from_status?: string | null;
          to_status?: string;
          changed_by?: string | null;
          changed_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "status_changes_startup_id_fkey";
            columns: ["startup_id"];
            isOneToOne: false;
            referencedRelation: "startups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "status_changes_changed_by_fkey";
            columns: ["changed_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      founder_links: {
        Row: {
          id: string;
          startup_id: string;
          founder_name: string;
          linkedin_url: string;
          added_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          startup_id: string;
          founder_name: string;
          linkedin_url: string;
          added_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          startup_id?: string;
          founder_name?: string;
          linkedin_url?: string;
          added_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "founder_links_startup_id_fkey";
            columns: ["startup_id"];
            isOneToOne: false;
            referencedRelation: "startups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "founder_links_added_by_fkey";
            columns: ["added_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      reviews: {
        Row: {
          id: string;
          startup_id: string;
          version: number;
          verdict: Verdict | null;
          thesis: string | null;
          snapshot: string;
          why_invest: ReviewPoint[];
          why_not: ReviewPoint[];
          unknowns: string[];
          contradictions: Contradiction[];
          dismissed_contradiction_indices: number[];
          deck_document_id: string | null;
          evidence_document_ids: string[];
          enrichment_finding_id: string | null;
          generated_at: string;
          model_version: string;
        };
        Insert: {
          id?: string;
          startup_id: string;
          // version is never set by app code - a before-insert trigger
          // (set_review_version in schema.sql) always computes it, atomically
          // per startup, to rule out races between a manual Regenerate click
          // and a background auto-regeneration.
          verdict?: Verdict | null;
          thesis?: string | null;
          snapshot: string;
          why_invest: ReviewPoint[];
          why_not: ReviewPoint[];
          unknowns: string[];
          contradictions?: Contradiction[];
          dismissed_contradiction_indices?: number[];
          deck_document_id?: string | null;
          evidence_document_ids?: string[];
          enrichment_finding_id?: string | null;
          generated_at?: string;
          model_version: string;
        };
        Update: {
          id?: string;
          startup_id?: string;
          version?: number;
          verdict?: Verdict | null;
          thesis?: string | null;
          snapshot?: string;
          why_invest?: ReviewPoint[];
          why_not?: ReviewPoint[];
          unknowns?: string[];
          contradictions?: Contradiction[];
          dismissed_contradiction_indices?: number[];
          deck_document_id?: string | null;
          evidence_document_ids?: string[];
          enrichment_finding_id?: string | null;
          generated_at?: string;
          model_version?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reviews_startup_id_fkey";
            columns: ["startup_id"];
            isOneToOne: false;
            referencedRelation: "startups";
            referencedColumns: ["id"];
          },
        ];
      };
      enrichment_findings: {
        Row: {
          id: string;
          startup_id: string;
          source: EnrichmentSource;
          summary_text: string;
          last_round_summary: string | null;
          key_findings: KeyFinding[];
          raw_results: unknown;
          created_at: string;
        };
        Insert: {
          id?: string;
          startup_id: string;
          source?: EnrichmentSource;
          summary_text: string;
          last_round_summary?: string | null;
          key_findings?: KeyFinding[];
          raw_results?: unknown;
          created_at?: string;
        };
        Update: {
          id?: string;
          startup_id?: string;
          source?: EnrichmentSource;
          summary_text?: string;
          last_round_summary?: string | null;
          key_findings?: KeyFinding[];
          raw_results?: unknown;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "enrichment_findings_startup_id_fkey";
            columns: ["startup_id"];
            isOneToOne: false;
            referencedRelation: "startups";
            referencedColumns: ["id"];
          },
        ];
      };
      signup_requests: {
        Row: {
          id: string;
          name: string;
          email: string;
          password_encrypted: string;
          status: SignupRequestStatus;
          created_at: string;
          decided_at: string | null;
          decided_by: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          email: string;
          password_encrypted: string;
          status?: SignupRequestStatus;
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string;
          password_encrypted?: string;
          status?: SignupRequestStatus;
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "signup_requests_decided_by_fkey";
            columns: ["decided_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
