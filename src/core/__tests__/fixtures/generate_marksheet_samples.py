"""개인정보 없는 정오표 PDF 2종을 재생성한다. reportlab과 맑은 고딕이 필요하다."""
from pathlib import Path

from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

DEST = Path(__file__).resolve().parent
pdfmetrics.registerFont(TTFont("Malgun", r"C:\Windows\Fonts\malgun.ttf"))
POINTS = [10.4, 10, 10, 10, 19.6, 40]
KEY = ["1", "2", "3", "4", "5", "1"]
# (인쇄 총점, 틀린 문항 번호). 각 행의 응답에서 총점을 독립적으로 재구성할 수 있다.
CASES = [
    (89.6, [1]), (79.6, [1, 2]), (69.6, [1, 2, 3]),
    (59.6, [1, 2, 3, 4]), (90, [2]), (80, [2, 3]),
    (70, [2, 3, 4]), (60, [6]), (100, []), (0, [1, 2, 3, 4, 5, 6]),
]
QX = [112, 140, 168, 196, 224, 252]


def build(mode):
    filename = DEST / f"marksheet-decimal-{mode}.pdf"
    pdf = canvas.Canvas(str(filename), pagesize=(595, 842), invariant=1)
    pdf.setTitle(f"합성 정오표: 소수점·페이지 분리·{mode}")
    pdf.setAuthor("achievement-eval synthetic fixtures")

    def text(s, x, top, size=8):
        pdf.setFont("Malgun", size)
        pdf.drawCentredString(x, 842 - top, str(s))

    for page in range(2):
        text("정기시험교과목별 학생답 정오표", 297, 40, 15)
        text("검증용 합성 자료 - 실제 학생·학교·시험과 무관", 297, 59)
        text("2026학년도 2학기 주간 3학년 1반 기말고사 사회", 265, 76)
        for label, y in [("번호", 94), ("정답", 112), ("배점", 130)]:
            text(label, 86, y)
        text("반/번호", 30, 112)
        text("이름", 67, 112)
        for i, x in enumerate(QX):
            text(i + 1, x, 94)
            text(KEY[i], x, 112)
            text(f"{POINTS[i]:g}", x, 130)
        for x, label, value in [(406, "선택형", 100), (433, "서답형", 0), (459, "기타", 0), (486, "영역", 100)]:
            text(label, x, 94)
            text("총점" if x == 486 else "점수", x, 112)
            text(f"{value:.2f}", x, 130, 7)
        # 두 페이지에 같은 높이의 학생 행을 배치해 페이지 간 섞임도 검출한다.
        for j, (total, wrong) in enumerate(CASES[page * 5:page * 5 + 5]):
            seat = page * 5 + j + 1
            y = 157 + 25 * j
            text(f"1/{seat}", 30, y)
            text(f"합성{seat:02d}", 67, y)
            for i, x in enumerate(QX):
                answer = str(int(KEY[i]) % 5 + 1) if i + 1 in wrong else ("." if mode == "dots" else KEY[i])
                text(answer, x, y)
            for x, value in [(406, total), (433, 0), (459, 0), (486, total)]:
                text(f"{value:.2f}", x, y, 7)
        pdf.setLineWidth(0.4)
        for y in [82, 101, 119, 139, 170, 195, 220, 245, 270]:
            pdf.line(14, 842 - y, 505, 842 - y)
        for x in [14, 46, 100, 126, 154, 182, 210, 238, 266, 393, 419, 446, 472, 505]:
            pdf.line(x, 842 - 82, x, 842 - 270)
        text(f"정답 표시 방식: {'점 표시' if mode == 'dots' else '선택지 번호'} / {page + 1} of 2", 297, 300)
        text("성취수준 경계 바로 아래의 소수점 총점과 경계값을 검증합니다.", 297, 320)
        pdf.showPage()
    pdf.save()
    print(filename)


if __name__ == "__main__":
    for encoding in ["dots", "numbers"]:
        build(encoding)
