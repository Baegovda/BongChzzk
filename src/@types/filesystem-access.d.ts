// 이 저장소의 TypeScript DOM 라이브러리에는 폴더 선택 API가 없다.
// 크롬 업데이트 페이지에서만 쓰고, 파이어폭스 빌드는 이 경로를 타지 않는다.

interface FileSystemHandle {
    queryPermission(descriptor?: { mode?: "read" | "readwrite" }): Promise<PermissionState>;
    requestPermission(descriptor?: { mode?: "read" | "readwrite" }): Promise<PermissionState>;
}

interface Window {
    showDirectoryPicker(options?: {
        mode?: "read" | "readwrite";
        id?: string;
    }): Promise<FileSystemDirectoryHandle>;
}
