export interface Topic {
	id: number;
	title: string;
	intro_video_id: number | null;
	intro_video_url: string | null;
	hosted_by: string;
	brand_terms_id: number;
	brand_terms_title: string | null;
	brand_terms_url: string | null;
	custom_terms_id: number | null;
	custom_terms_title: string | null;
	custom_terms_url: string | null;
	invitation_id: number | null;
	invitation_title: string | null;
	invitation_edit_url: string | null;
	status: string;
	clips_count: number;
	links_count: number;
	clicks: number;
	created_at: string;
	updated_at: string;
}

export interface Theme {
	id: number;
	title: string;
	edit_url: string;
	topic_count: number;
	is_default: boolean;
	created_at: string;
}

export interface VideoValue {
	id: number;
	url: string;
}

export interface InvitationLink {
	id: number;
	topic_id: number;
	slug: string;
	type: string;
	status: string;
	clicks: number;
	clips_count: number;
	created_at: string;
}

export interface Clip {
	id: number;
	topic_id: number;
	invitation_link_id: number | null;
	name: string;
	video_url: string;
	transcript: string;
	social_handle: string;
	social_network: string;
	tag: string;
	status: string;
	email: string;
	topic_title: string;
	brand_terms_id: number | null;
	brand_terms_revision_id: number | null;
	custom_terms_id: number | null;
	custom_terms_revision_id: number | null;
	created_at: string;
	updated_at: string;
}

export interface TermsOption {
	id: number;
	title: string;
}

export interface BrandTerms {
	id: number;
	title: string;
	modified: string;
	edit_url: string;
	preview_url: string;
}

export interface CustomTermsItem {
	id: number;
	title: string;
	modified: string;
	edit_url: string;
	preview_url: string;
}

export interface Host {
	id: number;
	name: string;
	created_at: string;
}

declare global {
	interface Window {
		clipisodeAdmin?: {
			page: string;
			rest_root: string;
			nonce: string;
		};
	}
}
