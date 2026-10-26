from django import forms
from .models import Student, Fee, Payment
class StudentForm(forms.ModelForm):
    class Meta: model=Student; fields=['admission_number','name','course','specialization','year','status','phone']
class FeeForm(forms.ModelForm):
    class Meta: model=Fee; fields=['semester','amount','concession']
    def clean_semester(self):
        n=self.cleaned_data['semester']
        if not 1<=n<=8: raise forms.ValidationError('Semester must be between 1 and 8.')
        return n
class PaymentForm(forms.ModelForm):
    token=forms.UUIDField(widget=forms.HiddenInput)
    class Meta:
        model=Payment; fields=['fee','account','amount','date','method','reference','token']; widgets={'date':forms.DateInput(attrs={'type':'date'})}
    def __init__(self,*args,student,**kwargs):
        super().__init__(*args,**kwargs)
        self.fields['fee'].queryset=student.fees.all()
        self.fields['fee'].label_from_instance=lambda f:f'Semester {f.semester}'
        self.fields['method'].choices=[v for v in Payment._meta.get_field('method').choices if v[0]!='historical']
        self.fields['date'].required=True
        self.fields['amount'].min_value=0.01
    def clean_amount(self):
        n=self.cleaned_data['amount']
        if n<=0: raise forms.ValidationError('Enter a positive amount.')
        return n
