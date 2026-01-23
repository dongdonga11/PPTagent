
import { GitHubConfig } from "../types";

export interface GitHubResponse {
    success: boolean;
    url?: string;
    message?: string;
}

export const pushToGitHub = async (
    config: GitHubConfig,
    fileName: string,
    content: string,
    commitMessage: string
): Promise<GitHubResponse> => {
    if (!config.token || !config.owner || !config.repo) {
        return { success: false, message: "GitHub 配置不完整 (Token/Owner/Repo)" };
    }

    const path = config.path ? `${config.path.replace(/\/$/, '')}/${fileName}` : fileName;
    const apiUrl = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${path}`;
    
    try {
        // 1. Check if file exists to get SHA (for update)
        let sha: string | undefined = undefined;
        try {
            const getRes = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${config.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            if (getRes.ok) {
                const data = await getRes.json();
                sha = data.sha;
            }
        } catch (e) {
            // File likely doesn't exist, proceed to create
        }

        // 2. Encode content to Base64 (handle UTF-8)
        const encoder = new TextEncoder();
        const data = encoder.encode(content);
        let binary = '';
        const len = data.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(data[i]);
        }
        const contentBase64 = btoa(binary);

        // 3. PUT request to Create/Update
        const body: any = {
            message: commitMessage,
            content: contentBase64,
            branch: config.branch || 'main'
        };
        if (sha) {
            body.sha = sha;
        }

        const putRes = await fetch(apiUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${config.token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (putRes.ok) {
            const result = await putRes.json();
            return { success: true, url: result.content.html_url };
        } else {
            const err = await putRes.json();
            return { success: false, message: err.message || "Upload Failed" };
        }

    } catch (error) {
        return { success: false, message: (error as Error).message };
    }
};
