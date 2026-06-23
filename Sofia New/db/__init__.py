from .database import (
    init_db, get_db,
    create_user, get_user_by_email, get_user_by_id,
    deduct_credits, refund_credits, add_credits,
    record_payment, confirm_payment,
    CreditError,
)