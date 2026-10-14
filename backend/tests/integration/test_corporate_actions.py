"""Integration tests for Corporate Actions service."""

from pathlib import Path

from sqlalchemy.orm import Session

from nse_pipeline.services.corporate_action_service import CorporateActionService


def test_import_corporate_actions_csv(test_db_session: Session, tmp_path: Path):
    corp_csv = tmp_path / "corp_actions.csv"
    corp_csv.write_text(
        "symbol,series,event_type,ex_date,ratio_numerator,ratio_denominator,amount,notes\n"
        "RELIANCE,EQ,BONUS,2024-10-28,1,1,,1:1 Bonus Issue\n"
        "TCS,EQ,DIVIDEND,2024-05-16,,,28.0,Final Dividend Rs 28/share\n"
    )

    service = CorporateActionService(test_db_session)
    count = service.import_from_csv(corp_csv)
    assert count == 2

    # Query actions for RELIANCE
    actions = service.get_actions_for_symbol("RELIANCE")
    assert len(actions) == 1
    assert actions[0].event_type == "BONUS"
    assert float(actions[0].ratio_numerator) == 1.0
