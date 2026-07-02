import { Link } from "react-router-dom";
import PageContainer from "../components/common/PageContainer";

export default function NotFoundPage() {
  return (
    <PageContainer>
      <h1>페이지를 찾을 수 없습니다</h1>
      <p>
        <Link to="/">홈으로 돌아가기</Link>
      </p>
    </PageContainer>
  );
}
