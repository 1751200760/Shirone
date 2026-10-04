import type { ProjectItem } from "@/types/projectsConfig";

export const projectsData: ProjectItem[] = [];

export function getProjectsList(): ProjectItem[] {
	return projectsData;
}
